from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.voice_model import VoiceModel
from app.models.evaluation import Evaluation
from app.models.leaderboard import LeaderboardSnapshot

router = APIRouter(prefix="/api/v1/leaderboard", tags=["leaderboard"])

VALID_BATTLE_TYPES = {"tts", "stt", "s2s", "agent"}


@router.get("")
async def get_leaderboard(
    sort_by: str = "elo_rating",
    battle_type: str = "tts",
    db: AsyncSession = Depends(get_db),
):
    if battle_type not in VALID_BATTLE_TYPES:
        raise HTTPException(status_code=400, detail=f"battle_type must be one of {VALID_BATTLE_TYPES}")

    result = await db.execute(
        select(VoiceModel)
        .where(VoiceModel.model_type == battle_type)
        .order_by(VoiceModel.elo_rating.desc())
    )
    models = result.scalars().all()

    entries = []
    for rank, model in enumerate(models, 1):
        avg_result = await db.execute(
            select(
                func.avg(Evaluation.metrics_json["wer_score"].as_float()).label("avg_wer"),
                func.avg(Evaluation.metrics_json["semascore"].as_float()).label("avg_semascore"),
                func.avg(Evaluation.metrics_json["prosody_score"].as_float()).label("avg_prosody"),
                func.avg(Evaluation.metrics_json["utmos"].as_float()).label("avg_quality"),
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
    battle_type: str = "tts",
    db: AsyncSession = Depends(get_db),
):
    if battle_type not in VALID_BATTLE_TYPES:
        raise HTTPException(status_code=400, detail=f"battle_type must be one of {VALID_BATTLE_TYPES}")

    stmt = select(LeaderboardSnapshot).order_by(LeaderboardSnapshot.snapshot_date.asc())
    stmt = stmt.where(LeaderboardSnapshot.battle_type == battle_type)
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
