from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.voice_model import VoiceModel
from app.models.evaluation import Evaluation
from app.models.battle import Battle
from app.models.scenario import Scenario

router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])


@router.get("/summary")
async def get_summary(db: AsyncSession = Depends(get_db)):
    total_models = (await db.execute(select(func.count(VoiceModel.id)))).scalar() or 0
    total_evals = (await db.execute(select(func.count(Evaluation.id)))).scalar() or 0
    total_battles = (await db.execute(select(func.count(Battle.id)))).scalar() or 0
    total_scenarios = (await db.execute(select(func.count(Scenario.id)))).scalar() or 0
    completed_evals = (
        await db.execute(
            select(func.count(Evaluation.id)).where(Evaluation.status == "completed")
        )
    ).scalar() or 0

    return {
        "total_models": total_models,
        "total_evaluations": total_evals,
        "completed_evaluations": completed_evals,
        "total_battles": total_battles,
        "total_scenarios": total_scenarios,
    }


@router.get("/correlations")
async def get_correlations(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Evaluation.metrics_json).where(
            Evaluation.status == "completed",
            Evaluation.metrics_json.isnot(None),
        ).limit(500)
    )
    metrics_list = [row[0] for row in result.all()]

    return {
        "count": len(metrics_list),
        "metrics": metrics_list,
    }
