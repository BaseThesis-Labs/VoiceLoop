from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.voice_model import VoiceModel
from app.models.evaluation import Evaluation
from app.models.leaderboard import LeaderboardSnapshot

router = APIRouter(prefix="/api/v1/leaderboard", tags=["leaderboard"])


@router.get("")
async def get_leaderboard(
    sort_by: str = "elo_rating",
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(VoiceModel).order_by(VoiceModel.elo_rating.desc())
    )
    models = result.scalars().all()

    entries = []
    for rank, model in enumerate(models, 1):
        avg_result = await db.execute(
            select(
                func.avg(Evaluation.metrics_json["wer_score"].as_float()).label("avg_wer"),
                func.avg(Evaluation.metrics_json["semascore"].as_float()).label("avg_semascore"),
                func.avg(Evaluation.metrics_json["overall_prosody_score"].as_float()).label("avg_prosody"),
                func.avg(Evaluation.metrics_json["speech_quality_score"].as_float()).label("avg_quality"),
            ).where(
                Evaluation.model_id == model.id,
                Evaluation.status == "completed",
            )
        )
        avgs = avg_result.one()

        entries.append({
            "model_id": model.id,
            "model_name": model.name,
            "provider": model.provider,
            "elo_rating": model.elo_rating,
            "win_rate": model.win_rate,
            "total_battles": model.total_battles,
            "avg_wer": avgs.avg_wer,
            "avg_semascore": avgs.avg_semascore,
            "avg_prosody": avgs.avg_prosody,
            "avg_quality": avgs.avg_quality,
            "rank": rank,
        })

    return entries


@router.get("/history")
async def get_leaderboard_history(
    model_id: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(LeaderboardSnapshot).order_by(LeaderboardSnapshot.snapshot_date.asc())
    if model_id:
        stmt = stmt.where(LeaderboardSnapshot.model_id == model_id)
    result = await db.execute(stmt)
    snapshots = result.scalars().all()

    entries = []
    for s in snapshots:
        model_result = await db.execute(select(VoiceModel.name).where(VoiceModel.id == s.model_id))
        model_name = model_result.scalar_one_or_none() or "Unknown"
        entries.append({
            "model_id": s.model_id,
            "model_name": model_name,
            "elo_rating": s.elo_rating,
            "snapshot_date": s.snapshot_date.isoformat(),
        })

    return entries
