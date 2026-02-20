"""Experiment runner -- orchestrates TTS generation and scoring for all trials."""
import asyncio
import logging

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.models.experiment import Experiment, Trial
from app.models.voice_model import VoiceModel
from app.services.scoring import compute_trial_metrics, aggregate_experiment_results
from app.services.tts_service import generate_tts

logger = logging.getLogger("arena.experiment_runner")


async def run_experiment(experiment_id: str) -> None:
    """Run all trials for an experiment, score, aggregate, and store results."""
    try:
        await _execute_experiment(experiment_id)
    except Exception as e:
        logger.error("Experiment %s failed: %s", experiment_id, e)
        async with async_session() as db:
            result = await db.execute(
                select(Experiment).where(Experiment.id == experiment_id)
            )
            exp = result.scalar_one()
            exp.status = "failed"
            exp.error_message = str(e)
            await db.commit()


async def _execute_experiment(experiment_id: str) -> None:
    """Core experiment execution logic."""
    async with async_session() as db:
        result = await db.execute(
            select(Experiment).where(Experiment.id == experiment_id)
        )
        exp = result.scalar_one()

        # Resolve model specs to actual voice_id / model_id from DB
        model_specs = []
        for spec in exp.models_json:
            provider = spec["provider"]
            voice_id = spec.get("voice_id")

            if voice_id:
                vm_result = await db.execute(
                    select(VoiceModel).where(
                        VoiceModel.provider == provider,
                        VoiceModel.config_json["voice_id"].astext == voice_id,
                    )
                )
                vm = vm_result.scalar_one_or_none()
            else:
                vm_result = await db.execute(
                    select(VoiceModel).where(
                        VoiceModel.provider == provider,
                        VoiceModel.config_json.isnot(None),
                    ).limit(1)
                )
                vm = vm_result.scalar_one_or_none()

            if not vm:
                raise ValueError(f"No voice found for provider '{provider}'" +
                                 (f" with voice_id '{voice_id}'" if voice_id else ""))

            model_specs.append({
                "provider": provider,
                "voice_id": vm.config_json.get("voice_id"),
                "model_id": vm.config_json.get("model_id", ""),
            })

        # Create trial records
        prompts = exp.prompts_json
        trials = []
        for pi, prompt_text in enumerate(prompts):
            for ms in model_specs:
                trial = Trial(
                    experiment_id=experiment_id,
                    prompt_index=pi,
                    prompt_text=prompt_text,
                    provider=ms["provider"],
                    voice_id=ms["voice_id"],
                    model_id=ms["model_id"],
                    status="pending",
                )
                db.add(trial)
                trials.append(trial)

        exp.total_trials = len(trials)
        exp.status = "running"
        await db.commit()

        for t in trials:
            await db.refresh(t)

    # Run TTS generation in parallel batches
    loop = asyncio.get_event_loop()
    batch_size = 8

    for i in range(0, len(trials), batch_size):
        batch = trials[i:i + batch_size]
        tasks = []
        for trial in batch:
            tasks.append(
                loop.run_in_executor(
                    None, generate_tts, trial.prompt_text,
                    trial.provider, trial.voice_id, trial.model_id,
                )
            )
        results = await asyncio.gather(*tasks, return_exceptions=True)

        async with async_session() as db:
            for trial, tts_result in zip(batch, results):
                result = await db.execute(
                    select(Trial).where(Trial.id == trial.id)
                )
                t = result.scalar_one()

                if isinstance(tts_result, Exception):
                    t.status = "failed"
                    t.error_message = str(tts_result)
                    logger.error("Trial %s failed: %s", t.id, tts_result)
                else:
                    t.audio_path = tts_result["audio_path"]
                    t.audio_filename = tts_result["filename"]
                    t.duration_seconds = tts_result["duration_seconds"]
                    t.ttfb_ms = tts_result["ttfb_ms"]
                    t.generation_time_ms = tts_result["generation_time_ms"]

                    metrics = compute_trial_metrics(tts_result)
                    t.silence_ratio = metrics["silence_ratio"]
                    t.status = "completed"

            exp_result = await db.execute(
                select(Experiment).where(Experiment.id == experiment_id)
            )
            exp = exp_result.scalar_one()
            trial_results = await db.execute(
                select(Trial).where(Trial.experiment_id == experiment_id)
            )
            all_trials = trial_results.scalars().all()
            exp.completed_trials = sum(
                1 for t in all_trials if t.status in ("completed", "failed")
            )
            await db.commit()

    # Aggregate results
    async with async_session() as db:
        trial_results = await db.execute(
            select(Trial).where(Trial.experiment_id == experiment_id)
        )
        all_trials = trial_results.scalars().all()

        trial_dicts = [
            {
                "provider": t.provider,
                "voice_id": t.voice_id,
                "model_id": t.model_id,
                "prompt_index": t.prompt_index,
                "ttfb_ms": t.ttfb_ms,
                "generation_time_ms": t.generation_time_ms,
                "duration_seconds": t.duration_seconds,
                "silence_ratio": t.silence_ratio,
                "status": t.status,
            }
            for t in all_trials
        ]

        results = aggregate_experiment_results(trial_dicts)

        exp_result = await db.execute(
            select(Experiment).where(Experiment.id == experiment_id)
        )
        exp = exp_result.scalar_one()
        exp.results_json = results
        exp.status = "completed"
        exp.completed_trials = exp.total_trials
        await db.commit()

    logger.info("Experiment %s completed: winner=%s confidence=%s",
                experiment_id, results.get("winner"), results.get("confidence"))

    # Fire webhook if configured
    async with async_session() as db:
        exp_result = await db.execute(
            select(Experiment).where(Experiment.id == experiment_id)
        )
        exp = exp_result.scalar_one()
        if exp.webhook_url:
            try:
                async with httpx.AsyncClient() as client:
                    await client.post(
                        exp.webhook_url,
                        json={
                            "experiment_id": exp.id,
                            "status": "completed",
                            "results": results,
                        },
                        timeout=10,
                    )
                logger.info("Webhook sent for experiment %s", experiment_id)
            except Exception as e:
                logger.warning("Webhook failed for experiment %s: %s", experiment_id, e)
