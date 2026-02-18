import asyncio
import logging
import random

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.battle import Battle
from app.models.evaluation import Evaluation
from app.models.prompt import Prompt
from app.models.voice_model import VoiceModel
from app.schemas.battle import BattleCreate, BattleVote, BattleResponse, BattleGenerateResponse
from app.services.elo import update_elo
from app.services.tts_service import generate_tts

logger = logging.getLogger("arena.battles")

router = APIRouter(prefix="/api/v1/battles", tags=["battles"])


@router.post("/generate", response_model=BattleGenerateResponse)
async def generate_battle(db: AsyncSession = Depends(get_db)):
    """Generate a new battle: pick random prompt + 2 voices, generate TTS, create records."""
    # 1. Pick random prompt
    prompt_count = (await db.execute(select(func.count(Prompt.id)))).scalar_one()
    if prompt_count == 0:
        raise HTTPException(status_code=500, detail="No prompts in database. Run seed.py first.")
    result = await db.execute(select(Prompt).offset(random.randint(0, prompt_count - 1)).limit(1))
    prompt = result.scalar_one()

    # 2. Pick 2 random distinct voice models from different providers
    all_models_result = await db.execute(
        select(VoiceModel)
        .where(VoiceModel.config_json.isnot(None))
        .order_by(func.random())
    )
    all_models = all_models_result.scalars().all()
    if len(all_models) < 2:
        raise HTTPException(status_code=500, detail="Need at least 2 models with voice config. Run seed.py first.")

    # Try to pick models from different providers for cross-provider comparison
    model_a = all_models[0]
    model_b = None
    for m in all_models[1:]:
        if m.provider != model_a.provider:
            model_b = m
            break
    # Fallback: if only one provider exists, pick any different model
    if model_b is None:
        model_b = all_models[1]

    # 3. Generate TTS for each voice
    loop = asyncio.get_event_loop()
    voice_id_a = model_a.config_json.get("voice_id")
    voice_id_b = model_b.config_json.get("voice_id")
    tts_model_id_a = model_a.config_json.get("model_id", "sonic-2024-12-12")
    tts_model_id_b = model_b.config_json.get("model_id", "sonic-2024-12-12")
    provider_a = model_a.provider
    provider_b = model_b.provider

    tts_a, tts_b = await asyncio.gather(
        loop.run_in_executor(None, generate_tts, prompt.text, provider_a, voice_id_a, tts_model_id_a),
        loop.run_in_executor(None, generate_tts, prompt.text, provider_b, voice_id_b, tts_model_id_b),
    )

    # 4. Create Evaluation records
    eval_a = Evaluation(
        model_id=model_a.id,
        status="pending",
        audio_path=tts_a["audio_path"],
        transcript_ref=prompt.text,
        duration_seconds=tts_a["duration_seconds"],
    )
    eval_b = Evaluation(
        model_id=model_b.id,
        status="pending",
        audio_path=tts_b["audio_path"],
        transcript_ref=prompt.text,
        duration_seconds=tts_b["duration_seconds"],
    )
    db.add(eval_a)
    db.add(eval_b)
    await db.flush()

    # 5. Create Battle record
    battle = Battle(
        scenario_id=(await db.execute(
            select(Prompt.scenario_id).where(Prompt.id == prompt.id)
        )).scalar_one() or (await db.execute(
            select(VoiceModel.id).limit(1)  # fallback — use first scenario
        )).scalar_one(),
        model_a_id=model_a.id,
        model_b_id=model_b.id,
        eval_a_id=eval_a.id,
        eval_b_id=eval_b.id,
    )

    # Handle scenario_id: use prompt's scenario or pick a random one
    from app.models.scenario import Scenario
    if prompt.scenario_id:
        battle.scenario_id = prompt.scenario_id
    else:
        scenario_result = await db.execute(
            select(Scenario.id).where(Scenario.category == prompt.category).limit(1)
        )
        scenario_id = scenario_result.scalar_one_or_none()
        if not scenario_id:
            scenario_result = await db.execute(select(Scenario.id).limit(1))
            scenario_id = scenario_result.scalar_one()
        battle.scenario_id = scenario_id

    db.add(battle)
    await db.commit()
    await db.refresh(battle)

    # 6. Kick off background evals
    try:
        from app.services.eval_service import submit_evaluation
        asyncio.create_task(submit_evaluation(eval_a.id))
        asyncio.create_task(submit_evaluation(eval_b.id))
    except Exception as e:
        logger.warning("Background eval failed to start: %s", e)

    # 7. Return response
    return BattleGenerateResponse(
        id=battle.id,
        prompt_text=prompt.text,
        prompt_category=prompt.category,
        audio_a_url=f"/api/v1/audio/{tts_a['filename']}",
        audio_b_url=f"/api/v1/audio/{tts_b['filename']}",
        model_a_id=model_a.id,
        model_b_id=model_b.id,
        model_a_name=model_a.name,
        model_b_name=model_b.name,
        provider_a=provider_a,
        provider_b=provider_b,
        eval_a_id=eval_a.id,
        eval_b_id=eval_b.id,
        duration_a=tts_a["duration_seconds"],
        duration_b=tts_b["duration_seconds"],
        ttfb_a=tts_a["ttfb_ms"],
        ttfb_b=tts_b["ttfb_ms"],
    )


@router.post("", response_model=BattleResponse, status_code=201)
async def create_battle(body: BattleCreate, db: AsyncSession = Depends(get_db)):
    battle = Battle(
        scenario_id=body.scenario_id,
        model_a_id=body.model_a_id,
        model_b_id=body.model_b_id,
    )
    db.add(battle)
    await db.commit()
    await db.refresh(battle)
    return battle


@router.get("", response_model=list[BattleResponse])
async def list_battles(
    scenario_id: str | None = None,
    model_id: str | None = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Battle).order_by(Battle.created_at.desc()).limit(limit)
    if scenario_id:
        stmt = stmt.where(Battle.scenario_id == scenario_id)
    if model_id:
        stmt = stmt.where(
            (Battle.model_a_id == model_id) | (Battle.model_b_id == model_id)
        )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{battle_id}", response_model=BattleResponse)
async def get_battle(battle_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Battle).where(Battle.id == battle_id))
    battle = result.scalar_one_or_none()
    if not battle:
        raise HTTPException(status_code=404, detail="Battle not found")
    return battle


@router.post("/{battle_id}/vote", response_model=BattleResponse)
async def vote_battle(
    battle_id: str, body: BattleVote, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Battle).where(Battle.id == battle_id))
    battle = result.scalar_one_or_none()
    if not battle:
        raise HTTPException(status_code=404, detail="Battle not found")
    if battle.winner is not None:
        raise HTTPException(status_code=400, detail="Battle already resolved")
    if body.winner not in ("a", "b", "tie"):
        raise HTTPException(status_code=400, detail="winner must be 'a', 'b', or 'tie'")

    model_a = (await db.execute(select(VoiceModel).where(VoiceModel.id == battle.model_a_id))).scalar_one()
    model_b = (await db.execute(select(VoiceModel).where(VoiceModel.id == battle.model_b_id))).scalar_one()

    new_a, new_b, delta = update_elo(model_a.elo_rating, model_b.elo_rating, body.winner)
    model_a.elo_rating = new_a
    model_a.total_battles += 1
    model_b.elo_rating = new_b
    model_b.total_battles += 1

    if body.winner == "a":
        total_wins_a = round(model_a.win_rate * (model_a.total_battles - 1)) + 1
        model_a.win_rate = total_wins_a / model_a.total_battles
        model_b.win_rate = round(model_b.win_rate * (model_b.total_battles - 1)) / model_b.total_battles
    elif body.winner == "b":
        model_a.win_rate = round(model_a.win_rate * (model_a.total_battles - 1)) / model_a.total_battles
        total_wins_b = round(model_b.win_rate * (model_b.total_battles - 1)) + 1
        model_b.win_rate = total_wins_b / model_b.total_battles

    battle.winner = body.winner
    battle.vote_source = "human"
    battle.elo_delta = delta

    await db.commit()
    await db.refresh(battle)
    return battle
