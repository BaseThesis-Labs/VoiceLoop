import asyncio
import logging
import random

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.database import get_db
from app.models.battle import Battle
from app.models.evaluation import Evaluation
from app.models.prompt import Prompt
from app.models.voice_model import VoiceModel
from fastapi import File, Form, UploadFile
from app.schemas.battle import BattleCreate, BattleVote, BattleResponse, BattleGenerateResponse, BattleGenerateRequest
from app.schemas.s2s import CuratedPromptItem, S2SBattleSetupResponse, S2SBattleResponse, S2SMetricsResponse, S2SModelMetrics
from app.schemas.stt import AudioClipItem, STTBattleSetupResponse, STTBattleResponse, STTTranscriptItem, STTMetricsResponse, STTModelMetrics, STTDiffItem
from app.schemas.agent import AgentBattleSetupResponse, ScenarioItem, AgentConfigItem, AgentVoteRequest, AgentMetricsResponse, AgentModelMetrics
from app.models.agent_configuration import AgentConfiguration
from app.models.agent_conversation import AgentConversation
from app.models.agent_battle import AgentBattle
from app.models.scenario import Scenario
from app.services.elo import update_elo
from app.services.tts_service import generate_tts
import uuid

logger = logging.getLogger("arena.battles")

router = APIRouter(prefix="/api/v1/battles", tags=["battles"])

PROVIDERS = ["cartesia", "elevenlabs", "smallestai", "deepgram"]
S2S_PROVIDERS = ["openai", "hume"]
STT_PROVIDERS = ["openai", "deepgram", "assemblyai", "google"]

VALID_BATTLE_TYPES = {"tts", "stt", "s2s", "agent"}


@router.post("/generate")
async def generate_battle(
    body: BattleGenerateRequest | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Generate a new 4-model battle: pick random prompt + 1 voice per provider, generate TTS."""
    battle_type = body.battle_type if body else "tts"
    if battle_type not in VALID_BATTLE_TYPES:
        raise HTTPException(status_code=400, detail=f"battle_type must be one of {VALID_BATTLE_TYPES}")
    if battle_type not in ("tts", "s2s", "stt", "agent"):
        raise HTTPException(status_code=501, detail=f"{battle_type} battles are not yet implemented")

    # --- S2S: Step 1 — select models, return setup response ---
    if battle_type == "s2s":
        return await _generate_s2s_battle(db)

    # --- STT: Step 1 — select models, return setup response ---
    if battle_type == "stt":
        return await _generate_stt_battle(db)

    # --- Agent: Step 1 — select scenario + configs, return setup ---
    if battle_type == "agent":
        return await _generate_agent_battle(db)

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

    # Agent battles: update agent config ELO, not voice model ELO
    if battle.battle_type == "agent":
        agent_battle = (await db.execute(
            select(AgentBattle).where(AgentBattle.battle_id == battle_id)
        )).scalar_one_or_none()

        if agent_battle:
            configs_result = await db.execute(
                select(AgentConfiguration).where(
                    AgentConfiguration.id.in_([agent_battle.config_a_id, agent_battle.config_b_id])
                )
            )
            configs_map = {c.id: c for c in configs_result.scalars().all()}

            label_to_config_id = {"a": agent_battle.config_a_id, "b": agent_battle.config_b_id}

            if body.winner not in ("tie", "all_bad"):
                winner_config_id = label_to_config_id[body.winner]
                winner_config = configs_map.get(winner_config_id)
                if winner_config:
                    for label, cid in label_to_config_id.items():
                        if label == body.winner:
                            continue
                        loser_config = configs_map.get(cid)
                        if loser_config:
                            new_w, new_l, delta = update_elo(winner_config.elo_rating, loser_config.elo_rating, "a")
                            winner_config.elo_rating = new_w
                            loser_config.elo_rating = new_l
                            loser_config.total_battles += 1
                    winner_config.total_battles += 1
                    total_wins = round(winner_config.win_rate * (winner_config.total_battles - 1)) + 1
                    winner_config.win_rate = total_wins / winner_config.total_battles
            elif body.winner == "tie":
                for cid in label_to_config_id.values():
                    c = configs_map.get(cid)
                    if c:
                        c.total_battles += 1

            # Store sub_votes on agent_battle
            if body.sub_votes:
                agent_battle.sub_votes_json = body.sub_votes

        battle.winner = body.winner
        battle.vote_source = "human"
        if body.sub_votes:
            battle.sub_votes = body.sub_votes

        await db.commit()
        await db.refresh(battle)
        return battle

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


# ---------------------------------------------------------------------------
# STT helpers and endpoints
# ---------------------------------------------------------------------------

async def _generate_stt_battle(db: AsyncSession) -> STTBattleSetupResponse:
    """Step 1: Select STT models, create battle, return setup response."""
    from app.models.audio_clip import AudioClip

    all_models_result = await db.execute(
        select(VoiceModel)
        .where(VoiceModel.config_json.isnot(None))
        .where(VoiceModel.model_type == "stt")
    )
    all_models = all_models_result.scalars().all()

    by_provider: dict[str, list] = {}
    for m in all_models:
        by_provider.setdefault(m.provider, []).append(m)

    selected = []
    for provider in STT_PROVIDERS:
        models = by_provider.get(provider, [])
        if models:
            selected.append(random.choice(models))

    if len(selected) < 2:
        raise HTTPException(status_code=500, detail="Need STT models from at least 2 providers. Run seed.py first.")

    random.shuffle(selected)
    selected = selected[:4]

    from app.models.scenario import Scenario
    scenario_result = await db.execute(select(Scenario.id).limit(1))
    scenario_id = scenario_result.scalar_one_or_none()
    if not scenario_id:
        raise HTTPException(status_code=500, detail="No scenarios in database. Run seed.py first.")

    battle = Battle(
        scenario_id=scenario_id,
        battle_type="stt",
        model_a_id=selected[0].id,
        model_b_id=selected[1].id,
        model_c_id=selected[2].id if len(selected) > 2 else None,
        model_d_id=selected[3].id if len(selected) > 3 else None,
    )
    db.add(battle)
    await db.commit()
    await db.refresh(battle)

    clips_result = await db.execute(select(AudioClip))
    clips = clips_result.scalars().all()
    curated_items = [
        AudioClipItem(
            id=c.id,
            text=c.ground_truth,
            category=c.category,
            difficulty=c.difficulty,
            audio_url=f"/api/v1/audio/{c.audio_path.split('/')[-1]}" if c.audio_path else "",
            duration_seconds=c.duration_seconds,
        )
        for c in clips
    ] if clips else None

    return STTBattleSetupResponse(
        id=battle.id,
        battle_type="stt",
        model_count=len(selected),
        curated_clips=curated_items,
    )


@router.post("/{battle_id}/stt-transcribe", response_model=STTBattleResponse)
async def submit_stt_input_audio(
    battle_id: str,
    audio: UploadFile | None = File(None),
    curated_clip_id: str | None = Form(None),
    db: AsyncSession = Depends(get_db),
):
    """Step 2: Submit input audio for an STT battle, fan out to providers."""
    from app.services.stt_service import transcribe_with_provider
    from app.models.audio_clip import AudioClip
    import os
    import uuid as _uuid

    result = await db.execute(select(Battle).where(Battle.id == battle_id))
    battle = result.scalar_one_or_none()
    if not battle:
        raise HTTPException(status_code=404, detail="Battle not found")
    if battle.battle_type != "stt":
        raise HTTPException(status_code=400, detail="Battle is not STT type")
    if battle.input_audio_path is not None:
        raise HTTPException(status_code=400, detail="Input audio already submitted")

    ground_truth = None
    if audio:
        os.makedirs(settings.audio_storage_path, exist_ok=True)
        input_filename = f"{_uuid.uuid4()}.webm"
        input_path = os.path.join(settings.audio_storage_path, input_filename)
        content = await audio.read()
        with open(input_path, "wb") as f:
            f.write(content)
    elif curated_clip_id:
        clip_result = await db.execute(
            select(AudioClip).where(AudioClip.id == curated_clip_id)
        )
        clip = clip_result.scalar_one_or_none()
        if not clip or not clip.audio_path:
            raise HTTPException(status_code=404, detail="Curated clip not found")
        input_path = clip.audio_path
        input_filename = input_path.split("/")[-1]
        ground_truth = clip.ground_truth
    else:
        raise HTTPException(status_code=400, detail="Must provide either audio file or curated_clip_id")

    battle.input_audio_path = input_path
    await db.flush()

    model_ids = [battle.model_a_id, battle.model_b_id]
    if battle.model_c_id:
        model_ids.append(battle.model_c_id)
    if battle.model_d_id:
        model_ids.append(battle.model_d_id)

    models_result = await db.execute(
        select(VoiceModel).where(VoiceModel.id.in_(model_ids))
    )
    models_map = {m.id: m for m in models_result.scalars().all()}
    models_ordered = [models_map[mid] for mid in model_ids]

    stt_tasks = [
        transcribe_with_provider(
            input_path,
            model.provider,
            model.config_json.get("model_id", model.name),
            model.config_json or {},
        )
        for model in models_ordered
    ]
    all_results = await asyncio.gather(*stt_tasks, return_exceptions=True)

    ok_models = []
    ok_results = []
    for model, res in zip(models_ordered, all_results):
        if isinstance(res, Exception):
            logger.error("STT failed for %s/%s: %s", model.provider, model.name, res)
            continue
        ok_models.append(model)
        ok_results.append(res)

    if len(ok_models) < 2:
        raise HTTPException(status_code=500, detail="STT transcription failed for too many providers")

    evals = []
    for i, model in enumerate(ok_models):
        ev = Evaluation(
            model_id=model.id,
            status="completed",
            audio_path=input_path,
            transcript_output=ok_results[i]["transcript"],
            transcript_ref=ground_truth,
        )
        db.add(ev)
        evals.append(ev)
    await db.flush()

    battle.model_a_id = ok_models[0].id
    battle.model_b_id = ok_models[1].id
    battle.model_c_id = ok_models[2].id if len(ok_models) > 2 else None
    battle.model_d_id = ok_models[3].id if len(ok_models) > 3 else None
    battle.eval_a_id = evals[0].id
    battle.eval_b_id = evals[1].id
    battle.eval_c_id = evals[2].id if len(evals) > 2 else None
    battle.eval_d_id = evals[3].id if len(evals) > 3 else None

    await db.commit()
    await db.refresh(battle)

    transcripts = []
    labels = ["a", "b", "c", "d"]
    for i, (model, result_data) in enumerate(zip(ok_models, ok_results)):
        transcripts.append(STTTranscriptItem(
            model_id=labels[i],
            transcript=result_data["transcript"],
            word_count=result_data["word_count"],
            e2e_latency_ms=result_data["e2e_latency_ms"],
            ttfb_ms=result_data["ttfb_ms"],
        ))

    return STTBattleResponse(
        id=battle.id,
        battle_type="stt",
        input_audio_url=f"/api/v1/audio/{input_filename}",
        ground_truth=None,
        transcripts=transcripts,
    )


@router.get("/{battle_id}/stt-metrics", response_model=STTMetricsResponse)
async def get_stt_metrics(battle_id: str, db: AsyncSession = Depends(get_db)):
    """Post-vote metrics for STT battles with diff highlighting and WER/CER."""
    from app.services.stt_metrics import compute_wer, compute_cer, compute_word_diff
    from app.models.audio_clip import AudioClip

    result = await db.execute(select(Battle).where(Battle.id == battle_id))
    battle = result.scalar_one_or_none()
    if not battle:
        raise HTTPException(status_code=404, detail="Battle not found")
    if battle.battle_type != "stt":
        raise HTTPException(status_code=400, detail="Battle is not STT type")
    if battle.winner is None:
        raise HTTPException(status_code=400, detail="Battle has not been voted on yet")

    eval_ids = [battle.eval_a_id, battle.eval_b_id, battle.eval_c_id, battle.eval_d_id]
    eval_ids = [eid for eid in eval_ids if eid]
    evals_result = await db.execute(
        select(Evaluation).where(Evaluation.id.in_(eval_ids))
    )
    evals_map = {e.id: e for e in evals_result.scalars().all()}

    model_ids = [battle.model_a_id, battle.model_b_id, battle.model_c_id, battle.model_d_id]
    model_ids = [mid for mid in model_ids if mid]
    models_result = await db.execute(
        select(VoiceModel).where(VoiceModel.id.in_(model_ids))
    )
    models_map = {m.id: m for m in models_result.scalars().all()}

    ground_truth = None
    if battle.input_audio_path:
        clip_result = await db.execute(
            select(AudioClip).where(AudioClip.audio_path == battle.input_audio_path)
        )
        clip = clip_result.scalar_one_or_none()
        if clip:
            ground_truth = clip.ground_truth

    labels = ["a", "b", "c", "d"]
    eval_id_map = {"a": battle.eval_a_id, "b": battle.eval_b_id, "c": battle.eval_c_id, "d": battle.eval_d_id}
    model_id_map = {"a": battle.model_a_id, "b": battle.model_b_id, "c": battle.model_c_id, "d": battle.model_d_id}

    active_labels = [l for l in labels if model_id_map.get(l)]

    model_names = {}
    providers = {}
    metrics = {}

    for label in active_labels:
        mid = model_id_map.get(label)
        if mid and mid in models_map:
            model_names[label] = models_map[mid].name
            providers[label] = models_map[mid].provider

        eid = eval_id_map.get(label)
        if eid and eid in evals_map:
            ev = evals_map[eid]
            transcript = ev.transcript_output or ""

            m = STTModelMetrics(
                transcript=transcript,
                e2e_latency_ms=0,
                ttfb_ms=0,
                word_count=len(transcript.split()),
            )

            if ground_truth:
                m.wer = round(compute_wer(ground_truth, transcript), 4)
                m.cer = round(compute_cer(ground_truth, transcript), 4)
                diff_data = compute_word_diff(ground_truth, transcript)
                m.diff = [STTDiffItem(**d) for d in diff_data]

            metrics[label] = m

    return STTMetricsResponse(
        status="complete",
        model_names=model_names or None,
        providers=providers or None,
        ground_truth=ground_truth,
        metrics=metrics or None,
    )


# ---------------------------------------------------------------------------
# S2S helpers and endpoints
# ---------------------------------------------------------------------------

async def _generate_s2s_battle(db: AsyncSession) -> S2SBattleSetupResponse:
    """Step 1: Select S2S models, create battle, return setup response."""
    # Query S2S models
    all_models_result = await db.execute(
        select(VoiceModel)
        .where(VoiceModel.config_json.isnot(None))
        .where(VoiceModel.model_type == "s2s")
    )
    all_models = all_models_result.scalars().all()

    # Group by provider, pick one random model per provider
    by_provider: dict[str, list] = {}
    for m in all_models:
        by_provider.setdefault(m.provider, []).append(m)

    selected = []
    for provider in S2S_PROVIDERS:
        models = by_provider.get(provider, [])
        if models:
            selected.append(random.choice(models))

    if len(selected) < 2:
        raise HTTPException(status_code=500, detail="Need S2S models from at least 2 providers. Run seed.py first.")

    # Shuffle so position doesn't reveal provider
    random.shuffle(selected)
    # Take 2-3 models max
    selected = selected[:3]

    # Create Battle record (no evals yet — they come in step 2)
    from app.models.scenario import Scenario
    scenario_result = await db.execute(select(Scenario.id).limit(1))
    scenario_id = scenario_result.scalar_one_or_none()
    if not scenario_id:
        raise HTTPException(status_code=500, detail="No scenarios in database. Run seed.py first.")

    battle = Battle(
        scenario_id=scenario_id,
        battle_type="s2s",
        model_a_id=selected[0].id,
        model_b_id=selected[1].id,
        model_c_id=selected[2].id if len(selected) > 2 else None,
    )
    db.add(battle)
    await db.commit()
    await db.refresh(battle)

    # Fetch curated S2S prompts
    curated_result = await db.execute(
        select(Prompt).where(Prompt.prompt_type == "audio")
    )
    curated_prompts = curated_result.scalars().all()
    curated_items = [
        CuratedPromptItem(
            id=p.id,
            text=p.text,
            category=p.category,
            audio_url=f"/api/v1/audio/{p.audio_path.split('/')[-1]}" if p.audio_path else "",
            duration_seconds=p.duration_seconds,
        )
        for p in curated_prompts
    ] if curated_prompts else None

    return S2SBattleSetupResponse(
        id=battle.id,
        battle_type="s2s",
        model_count=len(selected),
        curated_prompts=curated_items,
    )


@router.post("/{battle_id}/input-audio", response_model=S2SBattleResponse)
async def submit_s2s_input_audio(
    battle_id: str,
    audio: UploadFile | None = File(None),
    curated_prompt_id: str | None = Form(None),
    db: AsyncSession = Depends(get_db),
):
    """Step 2: Submit input audio for an S2S battle, fan out to providers."""
    from app.services.s2s_service import generate_s2s, S2SProviderError
    from app.services.transcription_service import transcribe_audio
    import os
    import uuid as _uuid

    # 1. Load battle
    result = await db.execute(select(Battle).where(Battle.id == battle_id))
    battle = result.scalar_one_or_none()
    if not battle:
        raise HTTPException(status_code=404, detail="Battle not found")
    if battle.battle_type != "s2s":
        raise HTTPException(status_code=400, detail="Battle is not S2S type")
    if battle.input_audio_path is not None:
        raise HTTPException(status_code=400, detail="Input audio already submitted")

    # 2. Determine input source
    if audio:
        os.makedirs(settings.audio_storage_path, exist_ok=True)
        input_filename = f"{_uuid.uuid4()}.webm"
        input_path = os.path.join(settings.audio_storage_path, input_filename)
        content = await audio.read()
        with open(input_path, "wb") as f:
            f.write(content)
    elif curated_prompt_id:
        prompt_result = await db.execute(
            select(Prompt).where(Prompt.id == curated_prompt_id)
        )
        prompt = prompt_result.scalar_one_or_none()
        if not prompt or not prompt.audio_path:
            raise HTTPException(status_code=404, detail="Curated prompt not found or has no audio")
        input_path = prompt.audio_path
        input_filename = input_path.split("/")[-1]
    else:
        raise HTTPException(status_code=400, detail="Must provide either audio file or curated_prompt_id")

    # Store input audio path
    battle.input_audio_path = input_path
    await db.flush()

    # 3. Load selected models
    model_ids = [battle.model_a_id, battle.model_b_id]
    if battle.model_c_id:
        model_ids.append(battle.model_c_id)

    models_result = await db.execute(
        select(VoiceModel).where(VoiceModel.id.in_(model_ids))
    )
    models_map = {m.id: m for m in models_result.scalars().all()}
    models_ordered = [models_map[mid] for mid in model_ids]

    # 4. Fan out to providers + transcription in parallel
    s2s_tasks = [
        generate_s2s(
            input_path,
            model.provider,
            model.config_json.get("model_id", model.name),
            model.config_json or {},
        )
        for model in models_ordered
    ]
    transcript_task = transcribe_audio(input_path)
    all_results = await asyncio.gather(*s2s_tasks, transcript_task, return_exceptions=True)

    s2s_results = all_results[:-1]
    transcript = all_results[-1] if not isinstance(all_results[-1], Exception) else None

    # 5. Filter out failed models (need >= 2 successful)
    ok_models = []
    ok_results = []
    for model, res in zip(models_ordered, s2s_results):
        if isinstance(res, Exception):
            logger.error("S2S failed for %s/%s: %s", model.provider, model.name, res)
            continue
        ok_models.append(model)
        ok_results.append(res)

    if len(ok_models) < 2:
        raise HTTPException(status_code=500, detail="S2S generation failed for too many providers")

    # 6. Create Evaluation records
    evals = []
    for i, model in enumerate(ok_models):
        ev = Evaluation(
            model_id=model.id,
            status="pending",
            audio_path=ok_results[i]["audio_path"],
            duration_seconds=ok_results[i]["duration_seconds"],
        )
        db.add(ev)
        evals.append(ev)
    await db.flush()

    # 7. Update Battle with eval IDs and potentially reduced model set
    battle.model_a_id = ok_models[0].id
    battle.model_b_id = ok_models[1].id
    battle.model_c_id = ok_models[2].id if len(ok_models) > 2 else None
    battle.eval_a_id = evals[0].id
    battle.eval_b_id = evals[1].id
    battle.eval_c_id = evals[2].id if len(evals) > 2 else None

    await db.commit()
    await db.refresh(battle)

    # 8. Kick off background eval tasks
    try:
        from app.services.eval_service import submit_evaluation
        for ev in evals:
            asyncio.create_task(submit_evaluation(ev.id))
    except Exception as e:
        logger.warning("Background eval failed to start: %s", e)

    # 9. Build response
    resp = S2SBattleResponse(
        id=battle.id,
        battle_type="s2s",
        input_audio_url=f"/api/v1/audio/{input_filename}",
        input_transcript=transcript,
        audio_a_url=f"/api/v1/audio/{ok_results[0]['filename']}",
        audio_b_url=f"/api/v1/audio/{ok_results[1]['filename']}",
        model_a_id=ok_models[0].id,
        model_b_id=ok_models[1].id,
        e2e_latency_a=ok_results[0]["e2e_latency_ms"],
        e2e_latency_b=ok_results[1]["e2e_latency_ms"],
        ttfb_a=ok_results[0]["ttfb_ms"],
        ttfb_b=ok_results[1]["ttfb_ms"],
        duration_a=ok_results[0]["duration_seconds"],
        duration_b=ok_results[1]["duration_seconds"],
    )

    if len(ok_models) > 2:
        resp.audio_c_url = f"/api/v1/audio/{ok_results[2]['filename']}"
        resp.model_c_id = ok_models[2].id
        resp.e2e_latency_c = ok_results[2]["e2e_latency_ms"]
        resp.ttfb_c = ok_results[2]["ttfb_ms"]
        resp.duration_c = ok_results[2]["duration_seconds"]

    return resp


@router.get("/{battle_id}/metrics", response_model=S2SMetricsResponse)
async def get_battle_metrics(battle_id: str, db: AsyncSession = Depends(get_db)):
    """Post-vote progressive metrics endpoint for S2S battles."""
    result = await db.execute(select(Battle).where(Battle.id == battle_id))
    battle = result.scalar_one_or_none()
    if not battle:
        raise HTTPException(status_code=404, detail="Battle not found")
    if battle.winner is None:
        raise HTTPException(status_code=400, detail="Battle has not been voted on yet")

    # Load evaluations
    eval_ids = [battle.eval_a_id, battle.eval_b_id]
    if battle.eval_c_id:
        eval_ids.append(battle.eval_c_id)
    eval_ids = [eid for eid in eval_ids if eid]

    evals_result = await db.execute(
        select(Evaluation).where(Evaluation.id.in_(eval_ids))
    )
    evals_map = {e.id: e for e in evals_result.scalars().all()}

    # Load model names
    model_ids = [battle.model_a_id, battle.model_b_id]
    if battle.model_c_id:
        model_ids.append(battle.model_c_id)

    models_result = await db.execute(
        select(VoiceModel).where(VoiceModel.id.in_(model_ids))
    )
    models_map = {m.id: m for m in models_result.scalars().all()}

    # Determine status
    labels = ["a", "b"]
    if battle.model_c_id:
        labels.append("c")

    eval_id_map = {"a": battle.eval_a_id, "b": battle.eval_b_id, "c": battle.eval_c_id}
    model_id_map = {"a": battle.model_a_id, "b": battle.model_b_id, "c": battle.model_c_id}

    completed_count = sum(
        1 for label in labels
        if eval_id_map.get(label) and evals_map.get(eval_id_map[label]) and evals_map[eval_id_map[label]].status == "completed"
    )

    if completed_count == len(labels):
        status = "complete"
    elif completed_count > 0:
        status = "partial"
    else:
        status = "computing"

    model_names = {}
    providers = {}
    metrics = {}

    for label in labels:
        mid = model_id_map.get(label)
        if mid and mid in models_map:
            model_names[label] = models_map[mid].name
            providers[label] = models_map[mid].provider

        eid = eval_id_map.get(label)
        if eid and eid in evals_map:
            ev = evals_map[eid]
            m = S2SModelMetrics()
            if ev.transcript_output:
                m.transcript = ev.transcript_output
            if ev.metrics_json:
                m.utmos = ev.metrics_json.get("utmos")
                m.prosody_score = ev.metrics_json.get("prosody_score")
                m.relevance_score = ev.metrics_json.get("relevance_score")
            metrics[label] = m

    return S2SMetricsResponse(
        status=status,
        model_names=model_names or None,
        providers=providers or None,
        metrics=metrics or None,
    )


# ---------------------------------------------------------------------------
# Agent helpers and endpoints
# ---------------------------------------------------------------------------

async def _generate_agent_battle(db: AsyncSession):
    """Generate an agent battle: pick a random scenario + 2 agent configs from different providers."""
    # Pick a random scenario that has a system_prompt (agent-enabled)
    result = await db.execute(
        select(Scenario)
        .where(Scenario.system_prompt.isnot(None))
        .order_by(func.random())
        .limit(1)
    )
    scenario = result.scalar_one_or_none()
    if not scenario:
        raise HTTPException(status_code=404, detail="No agent scenarios available. Run seed script.")

    # Get all agent configs, group by provider
    result = await db.execute(select(AgentConfiguration))
    all_configs = result.scalars().all()
    if len(all_configs) < 2:
        raise HTTPException(status_code=404, detail="Need at least 2 agent configurations. Run seed script.")

    by_provider: dict[str, list] = {}
    for c in all_configs:
        by_provider.setdefault(c.provider, []).append(c)

    # Pick one config per provider, then select 2
    selected = []
    for provider_configs in by_provider.values():
        selected.append(random.choice(provider_configs))
    random.shuffle(selected)
    selected = selected[:2]

    if len(selected) < 2:
        # If only one provider, pick two different configs from it
        all_shuffled = list(all_configs)
        random.shuffle(all_shuffled)
        selected = all_shuffled[:2]

    # Create Battle record (model_a_id/model_b_id are NULL for agent battles)
    battle_id = str(uuid.uuid4())
    battle = Battle(
        id=battle_id,
        scenario_id=scenario.id,
        battle_type="agent",
    )
    db.add(battle)

    # Create AgentBattle record
    agent_battle = AgentBattle(
        battle_id=battle_id,
        formulation="outcome",
        scenario_id=scenario.id,
        config_a_id=selected[0].id,
        config_b_id=selected[1].id,
    )
    db.add(agent_battle)
    await db.commit()

    return AgentBattleSetupResponse(
        id=battle_id,
        scenario=ScenarioItem(
            id=scenario.id,
            name=scenario.name,
            category=scenario.category,
            difficulty=scenario.difficulty,
            description=scenario.description,
            max_turns=scenario.max_turns,
            max_duration_seconds=scenario.max_duration_seconds,
        ),
        config_a=AgentConfigItem(
            id=selected[0].id,
            name=selected[0].name,
            architecture_type=selected[0].architecture_type,
            provider=selected[0].provider,
            components=selected[0].components_json,
        ),
        config_b=AgentConfigItem(
            id=selected[1].id,
            name=selected[1].name,
            architecture_type=selected[1].architecture_type,
            provider=selected[1].provider,
            components=selected[1].components_json,
        ),
        agent_battle_id=agent_battle.id,
    )


@router.get("/{battle_id}/agent-metrics", response_model=AgentMetricsResponse)
async def get_agent_metrics(battle_id: str, db: AsyncSession = Depends(get_db)):
    """Get progressive post-vote metrics for an agent battle."""
    battle = (await db.execute(select(Battle).where(Battle.id == battle_id))).scalar_one_or_none()
    if not battle or battle.battle_type != "agent":
        raise HTTPException(status_code=404, detail="Agent battle not found")
    if not battle.winner:
        raise HTTPException(status_code=400, detail="Vote not yet submitted")

    agent_battle = (await db.execute(
        select(AgentBattle).where(AgentBattle.battle_id == battle_id)
    )).scalar_one_or_none()
    if not agent_battle:
        raise HTTPException(status_code=404, detail="Agent battle record not found")

    scenario = (await db.execute(
        select(Scenario).where(Scenario.id == agent_battle.scenario_id)
    )).scalar_one_or_none()

    # Load conversations
    conv_a = None
    conv_b = None
    if agent_battle.conversation_a_id:
        conv_a = (await db.execute(
            select(AgentConversation).where(AgentConversation.id == agent_battle.conversation_a_id)
        )).scalar_one_or_none()
    if agent_battle.conversation_b_id:
        conv_b = (await db.execute(
            select(AgentConversation).where(AgentConversation.id == agent_battle.conversation_b_id)
        )).scalar_one_or_none()

    # Load configs
    config_a = (await db.execute(
        select(AgentConfiguration).where(AgentConfiguration.id == agent_battle.config_a_id)
    )).scalar_one_or_none()
    config_b = (await db.execute(
        select(AgentConfiguration).where(AgentConfiguration.id == agent_battle.config_b_id)
    )).scalar_one_or_none()

    # Check if automated eval is done
    automated_eval = agent_battle.automated_eval_json
    status = "complete" if automated_eval else ("partial" if conv_a and conv_b else "computing")

    # If no eval yet and both conversations exist, kick off eval
    if not automated_eval and conv_a and conv_b and scenario:
        from app.services.agent_eval_service import evaluate_agent_conversation
        from app.database import async_session as async_session_factory

        async def run_eval():
            eval_a = await evaluate_agent_conversation(
                conv_a.turns_json or [],
                scenario.description,
                scenario.success_criteria,
                scenario.required_slots,
            )
            eval_b = await evaluate_agent_conversation(
                conv_b.turns_json or [],
                scenario.description,
                scenario.success_criteria,
                scenario.required_slots,
            )
            result = {"a": eval_a, "b": eval_b}
            async with async_session_factory() as eval_db:
                ab = (await eval_db.execute(
                    select(AgentBattle).where(AgentBattle.battle_id == battle_id)
                )).scalar_one()
                ab.automated_eval_json = result
                if eval_a.get("task_success") is not None and conv_a:
                    ca = (await eval_db.execute(
                        select(AgentConversation).where(AgentConversation.id == conv_a.id)
                    )).scalar_one()
                    ca.task_success = eval_a.get("task_success")
                    ca.joint_goal_accuracy = eval_a.get("joint_goal_accuracy")
                if eval_b.get("task_success") is not None and conv_b:
                    cb = (await eval_db.execute(
                        select(AgentConversation).where(AgentConversation.id == conv_b.id)
                    )).scalar_one()
                    cb.task_success = eval_b.get("task_success")
                    cb.joint_goal_accuracy = eval_b.get("joint_goal_accuracy")
                await eval_db.commit()

        asyncio.create_task(run_eval())
        status = "computing"

    def _build_metrics(conv, config, label) -> AgentModelMetrics | None:
        if not conv or not config:
            return None
        return AgentModelMetrics(
            agent_label=label,
            config_name=config.name,
            provider=config.provider,
            components=config.components_json,
            total_turns=conv.total_turns,
            duration_seconds=conv.duration_seconds,
            avg_latency_ms=conv.avg_response_latency_ms,
            p50_latency_ms=conv.p50_latency_ms,
            p95_latency_ms=conv.p95_latency_ms,
            task_success=conv.task_success,
            joint_goal_accuracy=conv.joint_goal_accuracy,
            containment=conv.containment,
        )

    return AgentMetricsResponse(
        status=status,
        scenario_name=scenario.name if scenario else None,
        metrics_a=_build_metrics(conv_a, config_a, "a"),
        metrics_b=_build_metrics(conv_b, config_b, "b"),
        automated_eval=automated_eval,
    )
