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
from app.schemas.battle import BattleCreate, BattleVote, BattleResponse, BattleGenerateResponse, BattleGenerateRequest
from app.services.elo import update_elo
from app.services.tts_service import generate_tts

logger = logging.getLogger("arena.battles")

router = APIRouter(prefix="/api/v1/battles", tags=["battles"])

PROVIDERS = ["cartesia", "elevenlabs", "smallestai", "deepgram"]

VALID_BATTLE_TYPES = {"tts", "stt", "s2s", "agent"}


@router.post("/generate", response_model=BattleGenerateResponse)
async def generate_battle(
    body: BattleGenerateRequest | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Generate a new 4-model battle: pick random prompt + 1 voice per provider, generate TTS."""
    battle_type = body.battle_type if body else "tts"
    if battle_type not in VALID_BATTLE_TYPES:
        raise HTTPException(status_code=400, detail=f"battle_type must be one of {VALID_BATTLE_TYPES}")
    if battle_type != "tts":
        raise HTTPException(status_code=501, detail=f"{battle_type} battles are not yet implemented")

    # 1. Pick random prompt
    prompt_count = (await db.execute(select(func.count(Prompt.id)))).scalar_one()
    if prompt_count == 0:
        raise HTTPException(status_code=500, detail="No prompts in database. Run seed.py first.")
    result = await db.execute(select(Prompt).offset(random.randint(0, prompt_count - 1)).limit(1))
    prompt = result.scalar_one()

    # 2. Pick one random model from each provider
    all_models_result = await db.execute(
        select(VoiceModel)
        .where(VoiceModel.config_json.isnot(None))
        .where(VoiceModel.model_type == battle_type)
    )
    all_models = all_models_result.scalars().all()

    # Group by provider
    by_provider: dict[str, list] = {}
    for m in all_models:
        by_provider.setdefault(m.provider, []).append(m)

    # Pick one from each available provider
    selected = []
    for provider in PROVIDERS:
        models = by_provider.get(provider, [])
        if models:
            selected.append(random.choice(models))

    if len(selected) < 2:
        raise HTTPException(status_code=500, detail="Need models from at least 2 providers. Run seed.py first.")

    # Shuffle so position doesn't reveal provider
    random.shuffle(selected)

    # Pad labels: positions are a, b, c, d
    labels = ["a", "b", "c", "d"]

    # 3. Generate TTS for all models in parallel
    loop = asyncio.get_event_loop()
    tts_tasks = []
    for model in selected:
        voice_id = model.config_json.get("voice_id")
        tts_model_id = model.config_json.get("model_id", "sonic-3")
        tts_tasks.append(
            loop.run_in_executor(None, generate_tts, prompt.text, model.provider, voice_id, tts_model_id)
        )
    raw_results = await asyncio.gather(*tts_tasks, return_exceptions=True)

    # Filter out failed providers
    ok_models = []
    tts_results = []
    for model, result in zip(selected, raw_results):
        if isinstance(result, Exception):
            logger.error("TTS failed for %s/%s: %s", model.provider, model.name, result)
            continue
        ok_models.append(model)
        tts_results.append(result)
    selected = ok_models

    if len(selected) < 2:
        raise HTTPException(status_code=500, detail="TTS generation failed for too many providers")

    # 4. Create Evaluation records
    evals = []
    for i, model in enumerate(selected):
        ev = Evaluation(
            model_id=model.id,
            status="pending",
            audio_path=tts_results[i]["audio_path"],
            transcript_ref=prompt.text,
            duration_seconds=tts_results[i]["duration_seconds"],
        )
        db.add(ev)
        evals.append(ev)
    await db.flush()

    # 5. Create Battle record
    from app.models.scenario import Scenario
    scenario_id = prompt.scenario_id
    if not scenario_id:
        scenario_result = await db.execute(
            select(Scenario.id).where(Scenario.category == prompt.category).limit(1)
        )
        scenario_id = scenario_result.scalar_one_or_none()
        if not scenario_id:
            scenario_result = await db.execute(select(Scenario.id).limit(1))
            scenario_id = scenario_result.scalar_one()

    battle = Battle(
        scenario_id=scenario_id,
        battle_type=battle_type,
        model_a_id=selected[0].id,
        model_b_id=selected[1].id,
        model_c_id=selected[2].id if len(selected) > 2 else None,
        model_d_id=selected[3].id if len(selected) > 3 else None,
        eval_a_id=evals[0].id,
        eval_b_id=evals[1].id,
        eval_c_id=evals[2].id if len(evals) > 2 else None,
        eval_d_id=evals[3].id if len(evals) > 3 else None,
    )
    db.add(battle)
    await db.commit()
    await db.refresh(battle)

    # 6. Kick off background evals
    try:
        from app.services.eval_service import submit_evaluation
        for ev in evals:
            asyncio.create_task(submit_evaluation(ev.id))
    except Exception as e:
        logger.warning("Background eval failed to start: %s", e)

    # 7. Build response
    resp = BattleGenerateResponse(
        id=battle.id,
        battle_type=battle_type,
        prompt_text=prompt.text,
        prompt_category=prompt.category,
        audio_a_url=f"/api/v1/audio/{tts_results[0]['filename']}",
        audio_b_url=f"/api/v1/audio/{tts_results[1]['filename']}",
        model_a_id=selected[0].id,
        model_b_id=selected[1].id,
        model_a_name=selected[0].name,
        model_b_name=selected[1].name,
        provider_a=selected[0].provider,
        provider_b=selected[1].provider,
        eval_a_id=evals[0].id,
        eval_b_id=evals[1].id,
        duration_a=tts_results[0]["duration_seconds"],
        duration_b=tts_results[1]["duration_seconds"],
        ttfb_a=tts_results[0]["ttfb_ms"],
        ttfb_b=tts_results[1]["ttfb_ms"],
    )

    if len(selected) > 2:
        resp.audio_c_url = f"/api/v1/audio/{tts_results[2]['filename']}"
        resp.model_c_id = selected[2].id
        resp.model_c_name = selected[2].name
        resp.provider_c = selected[2].provider
        resp.eval_c_id = evals[2].id
        resp.duration_c = tts_results[2]["duration_seconds"]
        resp.ttfb_c = tts_results[2]["ttfb_ms"]

    if len(selected) > 3:
        resp.audio_d_url = f"/api/v1/audio/{tts_results[3]['filename']}"
        resp.model_d_id = selected[3].id
        resp.model_d_name = selected[3].name
        resp.provider_d = selected[3].provider
        resp.eval_d_id = evals[3].id
        resp.duration_d = tts_results[3]["duration_seconds"]
        resp.ttfb_d = tts_results[3]["ttfb_ms"]

    return resp


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
    battle_type: str | None = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Battle).order_by(Battle.created_at.desc()).limit(limit)
    if battle_type:
        stmt = stmt.where(Battle.battle_type == battle_type)
    if scenario_id:
        stmt = stmt.where(Battle.scenario_id == scenario_id)
    if model_id:
        stmt = stmt.where(
            (Battle.model_a_id == model_id) | (Battle.model_b_id == model_id)
            | (Battle.model_c_id == model_id) | (Battle.model_d_id == model_id)
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

    valid_choices = {"a", "b", "tie", "all_bad"}
    if battle.model_c_id:
        valid_choices.add("c")
    if battle.model_d_id:
        valid_choices.add("d")
    if body.winner not in valid_choices:
        raise HTTPException(status_code=400, detail=f"winner must be one of {valid_choices}")

    # Collect all participating models
    model_ids = [battle.model_a_id, battle.model_b_id]
    if battle.model_c_id:
        model_ids.append(battle.model_c_id)
    if battle.model_d_id:
        model_ids.append(battle.model_d_id)

    models_result = await db.execute(
        select(VoiceModel).where(VoiceModel.id.in_(model_ids))
    )
    models_map = {m.id: m for m in models_result.scalars().all()}

    label_to_id = {"a": battle.model_a_id, "b": battle.model_b_id}
    if battle.model_c_id:
        label_to_id["c"] = battle.model_c_id
    if battle.model_d_id:
        label_to_id["d"] = battle.model_d_id

    if body.winner not in ("tie", "all_bad"):
        # Winner gets ELO boost vs each loser (pairwise updates)
        winner_id = label_to_id[body.winner]
        winner_model = models_map[winner_id]
        total_delta = 0.0

        for label, mid in label_to_id.items():
            if label == body.winner:
                continue
            loser_model = models_map[mid]
            new_w, new_l, delta = update_elo(winner_model.elo_rating, loser_model.elo_rating, "a")
            winner_model.elo_rating = new_w
            loser_model.elo_rating = new_l
            loser_model.total_battles += 1
            loser_model.win_rate = round(loser_model.win_rate * (loser_model.total_battles - 1)) / loser_model.total_battles
            total_delta += delta

        winner_model.total_battles += 1
        total_wins = round(winner_model.win_rate * (winner_model.total_battles - 1)) + 1
        winner_model.win_rate = total_wins / winner_model.total_battles
        battle.elo_delta = total_delta
    elif body.winner == "tie":
        # Tie: pairwise tie updates between all pairs
        ids = list(label_to_id.values())
        for i in range(len(ids)):
            for j in range(i + 1, len(ids)):
                m_i = models_map[ids[i]]
                m_j = models_map[ids[j]]
                new_i, new_j, _ = update_elo(m_i.elo_rating, m_j.elo_rating, "tie")
                m_i.elo_rating = new_i
                m_j.elo_rating = new_j
        for mid in ids:
            models_map[mid].total_battles += 1
        battle.elo_delta = 0.0
    # all_bad: no ELO changes, just increment battle counts
    else:
        for mid in label_to_id.values():
            models_map[mid].total_battles += 1
        battle.elo_delta = 0.0

    battle.winner = body.winner
    battle.vote_source = "human"
    if body.sub_votes:
        battle.sub_votes = body.sub_votes

    await db.commit()
    await db.refresh(battle)
    return battle
