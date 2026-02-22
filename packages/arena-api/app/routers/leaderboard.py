from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, case, literal
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.voice_model import VoiceModel
from app.models.evaluation import Evaluation
from app.models.agent_configuration import AgentConfiguration
from app.models.agent_conversation import AgentConversation
from app.models.leaderboard import LeaderboardSnapshot
from app.schemas.leaderboard import MetricConfig, LeaderboardResponse, LeaderboardEntry

router = APIRouter(prefix="/api/v1/leaderboard", tags=["leaderboard"])

VALID_BATTLE_TYPES = {"tts", "stt", "s2s", "agent"}

METRIC_CONFIGS: dict[str, list[MetricConfig]] = {
    "tts": [
        MetricConfig(key="avg_prosody", label="Prosody", format="decimal_2"),
        MetricConfig(key="avg_utmos", label="Quality (UTMOS)", format="decimal_2"),
        MetricConfig(key="avg_ttfb", label="Avg TTFB", format="ms", higher_is_better=False),
    ],
    "stt": [
        MetricConfig(key="avg_wer", label="WER", format="decimal_2", higher_is_better=False),
        MetricConfig(key="avg_cer", label="CER", format="decimal_2", higher_is_better=False),
        MetricConfig(key="avg_latency", label="Avg Latency", format="ms", higher_is_better=False),
    ],
    "s2s": [
        MetricConfig(key="avg_utmos", label="Quality (UTMOS)", format="decimal_2"),
        MetricConfig(key="avg_prosody", label="Prosody", format="decimal_2"),
        MetricConfig(key="avg_ttfb", label="Avg TTFB", format="ms", higher_is_better=False),
        MetricConfig(key="avg_e2e_latency", label="Avg E2E Latency", format="ms", higher_is_better=False),
    ],
    "agent": [
        MetricConfig(key="avg_task_success_rate", label="Task Success", format="percent"),
        MetricConfig(key="avg_coherence", label="Coherence", format="decimal_2"),
        MetricConfig(key="avg_latency", label="Avg Latency", format="ms", higher_is_better=False),
    ],
}


@router.get("", response_model=LeaderboardResponse)
async def get_leaderboard(
    sort_by: str = "elo_rating",
    battle_type: str = "tts",
    db: AsyncSession = Depends(get_db),
):
    if battle_type not in VALID_BATTLE_TYPES:
        raise HTTPException(status_code=400, detail=f"battle_type must be one of {VALID_BATTLE_TYPES}")

    configs = METRIC_CONFIGS[battle_type]
    metric_keys = [c.key for c in configs]

    if battle_type == "agent":
        entries = await _query_agent_leaderboard(db, metric_keys)
    else:
        entries = await _query_voice_leaderboard(db, battle_type, metric_keys)

    return LeaderboardResponse(entries=entries, metrics_config=configs)


async def _query_voice_leaderboard(
    db: AsyncSession,
    battle_type: str,
    metric_keys: list[str],
) -> list[LeaderboardEntry]:
    """Single grouped query for TTS, STT, and S2S leaderboards."""
    base_columns = [
        VoiceModel.id,
        VoiceModel.name,
        VoiceModel.provider,
        VoiceModel.model_type,
        VoiceModel.elo_rating,
        VoiceModel.win_rate,
        VoiceModel.total_battles,
    ]

    stmt = (
        select(*base_columns)
        .outerjoin(
            Evaluation,
            (Evaluation.model_id == VoiceModel.id) & (Evaluation.status == "completed"),
        )
        .where(VoiceModel.model_type == battle_type)
        .group_by(VoiceModel.id)
        .order_by(VoiceModel.elo_rating.desc())
    )

    # Add mode-specific aggregation columns
    if battle_type == "tts":
        stmt = stmt.add_columns(
            func.avg(Evaluation.metrics_json["prosody_score"].as_float()).label("avg_prosody"),
            func.avg(Evaluation.metrics_json["utmos"].as_float()).label("avg_utmos"),
            func.avg(Evaluation.ttfb_ms).label("avg_ttfb"),
        )
    elif battle_type == "stt":
        stmt = stmt.add_columns(
            func.avg(Evaluation.metrics_json["wer_score"].as_float()).label("avg_wer"),
            func.avg(Evaluation.metrics_json["cer_score"].as_float()).label("avg_cer"),
            func.avg(Evaluation.e2e_latency_ms).label("avg_latency"),
        )
    elif battle_type == "s2s":
        stmt = stmt.add_columns(
            func.avg(Evaluation.metrics_json["utmos"].as_float()).label("avg_utmos"),
            func.avg(Evaluation.metrics_json["prosody_score"].as_float()).label("avg_prosody"),
            func.avg(Evaluation.ttfb_ms).label("avg_ttfb"),
            func.avg(Evaluation.e2e_latency_ms).label("avg_e2e_latency"),
        )

    result = await db.execute(stmt)
    rows = result.all()

    entries: list[LeaderboardEntry] = []
    for rank, row in enumerate(rows, 1):
        metrics: dict[str, float | None] = {}
        for key in metric_keys:
            metrics[key] = getattr(row, key, None)

        entries.append(LeaderboardEntry(
            model_id=row.id,
            model_name=row.name,
            provider=row.provider,
            model_type=row.model_type,
            elo_rating=row.elo_rating,
            win_rate=row.win_rate,
            total_battles=row.total_battles,
            rank=rank,
            metrics=metrics,
        ))

    return entries


async def _query_agent_leaderboard(
    db: AsyncSession,
    metric_keys: list[str],
) -> list[LeaderboardEntry]:
    """Single grouped query for Agent leaderboard."""
    stmt = (
        select(
            AgentConfiguration.id,
            AgentConfiguration.name,
            AgentConfiguration.provider,
            literal("agent").label("model_type"),
            AgentConfiguration.elo_rating,
            AgentConfiguration.win_rate,
            AgentConfiguration.total_battles,
            func.avg(
                case(
                    (AgentConversation.task_success == None, None),  # noqa: E711
                    (AgentConversation.task_success == True, 1.0),  # noqa: E712
                    else_=0.0,
                )
            ).label("avg_task_success_rate"),
            func.avg(AgentConversation.joint_goal_accuracy).label("avg_coherence"),
            func.avg(AgentConversation.avg_response_latency_ms).label("avg_latency"),
        )
        .outerjoin(AgentConversation, AgentConversation.agent_config_id == AgentConfiguration.id)
        .group_by(AgentConfiguration.id)
        .order_by(AgentConfiguration.elo_rating.desc())
    )

    result = await db.execute(stmt)
    rows = result.all()

    entries: list[LeaderboardEntry] = []
    for rank, row in enumerate(rows, 1):
        metrics: dict[str, float | None] = {}
        for key in metric_keys:
            metrics[key] = getattr(row, key, None)

        entries.append(LeaderboardEntry(
            model_id=row.id,
            model_name=row.name,
            provider=row.provider,
            model_type=row.model_type,
            elo_rating=row.elo_rating,
            win_rate=row.win_rate,
            total_battles=row.total_battles,
            rank=rank,
            metrics=metrics,
        ))

    return entries


@router.post("/snapshot")
async def create_snapshot(
    battle_type: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Trigger snapshot creation. If no battle_type specified, create for all types."""
    from app.services.snapshot_service import create_daily_snapshot

    if battle_type:
        count = await create_daily_snapshot(db, battle_type)
        return {"created": count, "battle_type": battle_type}

    total = 0
    for bt in VALID_BATTLE_TYPES:
        count = await create_daily_snapshot(db, bt)
        total += count
    return {"created": total, "battle_types": list(VALID_BATTLE_TYPES)}


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
