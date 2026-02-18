import asyncio
from concurrent.futures import ProcessPoolExecutor
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.models.evaluation import Evaluation
from app.workers.eval_worker import run_evaluation

executor: ProcessPoolExecutor | None = None


def init_executor():
    global executor
    executor = ProcessPoolExecutor(max_workers=settings.max_eval_workers)


def shutdown_executor():
    global executor
    if executor:
        executor.shutdown(wait=False)
        executor = None


async def submit_evaluation(eval_id: str) -> None:
    if not executor:
        raise RuntimeError("Executor not initialized")

    loop = asyncio.get_event_loop()

    from app.database import async_session

    async with async_session() as db:
        result = await db.execute(select(Evaluation).where(Evaluation.id == eval_id))
        eval_record = result.scalar_one()
        eval_record.status = "running"
        await db.commit()
        audio_path = eval_record.audio_path
        ground_truth = eval_record.transcript_ref

    try:
        metrics_dict = await loop.run_in_executor(
            executor,
            run_evaluation,
            audio_path,
            ground_truth,
            settings.hf_token,
            settings.enable_diarization,
            settings.default_num_speakers,
        )

        async with async_session() as db:
            result = await db.execute(select(Evaluation).where(Evaluation.id == eval_id))
            eval_record = result.scalar_one()

            # Handle graceful failure from worker (missing dependencies etc.)
            if metrics_dict.get("status") == "failed":
                eval_record.status = "failed"
                eval_record.error_message = metrics_dict.get("error", "Unknown eval error")
            else:
                eval_record.status = "completed"
                eval_record.metrics_json = metrics_dict.get("overall_metrics")
                eval_record.diarization_json = {
                    "num_speakers": metrics_dict.get("num_speakers"),
                    "speaker_metrics": metrics_dict.get("speaker_metrics"),
                    "timeline": metrics_dict.get("diarization_timeline"),
                }
                eval_record.duration_seconds = (
                    eval_record.duration_seconds
                    or metrics_dict.get("overall_metrics", {}).get("total_duration_seconds")
                )
            await db.commit()

    except Exception as e:
        async with async_session() as db:
            result = await db.execute(select(Evaluation).where(Evaluation.id == eval_id))
            eval_record = result.scalar_one()
            eval_record.status = "failed"
            eval_record.error_message = str(e)
            await db.commit()
