import logging
from datetime import date
from sqlalchemy import select, func, case, literal
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.voice_model import VoiceModel
from app.models.evaluation import Evaluation
from app.models.agent_configuration import AgentConfiguration
from app.models.agent_conversation import AgentConversation
from app.models.leaderboard import LeaderboardSnapshot

logger = logging.getLogger("arena.snapshots")


async def create_daily_snapshot(db: AsyncSession, battle_type: str) -> int:
    """Create leaderboard snapshot records for the given battle type.

    Returns the number of snapshot records created.
    """
    today = date.today()

    # Check if snapshot already exists for today
    existing = await db.execute(
        select(func.count(LeaderboardSnapshot.id)).where(
            LeaderboardSnapshot.snapshot_date == today,
            LeaderboardSnapshot.battle_type == battle_type,
        )
    )
    if existing.scalar() > 0:
        logger.info("Snapshot for %s on %s already exists, skipping", battle_type, today)
        return 0

    if battle_type == "agent":
        return await _snapshot_agent(db, today)
    else:
        return await _snapshot_voice(db, battle_type, today)


async def _snapshot_voice(db: AsyncSession, battle_type: str, today: date) -> int:
    """Create snapshots for TTS/STT/S2S models."""
    # Query all models of this type with their aggregated metrics
    stmt = (
        select(
            VoiceModel.id,
            VoiceModel.elo_rating,
            VoiceModel.win_rate,
            VoiceModel.total_battles,
        )
        .where(VoiceModel.model_type == battle_type)
        .order_by(VoiceModel.elo_rating.desc())
    )
    result = await db.execute(stmt)
    models = result.all()

    # For each model, get avg metrics
    count = 0
    for rank, row in enumerate(models, 1):
        # Get mode-specific metrics
        metrics_stmt = select(
            func.avg(Evaluation.ttfb_ms).label("avg_ttfb"),
            func.avg(Evaluation.e2e_latency_ms).label("avg_e2e_latency"),
        ).where(
            Evaluation.model_id == row.id,
            Evaluation.status == "completed",
        )

        if battle_type == "tts":
            metrics_stmt = metrics_stmt.add_columns(
                func.avg(Evaluation.metrics_json["prosody_score"].as_float()).label("avg_prosody"),
                func.avg(Evaluation.metrics_json["utmos"].as_float()).label("avg_utmos"),
            )
        elif battle_type == "stt":
            metrics_stmt = metrics_stmt.add_columns(
                func.avg(Evaluation.metrics_json["wer_score"].as_float()).label("avg_wer"),
                func.avg(Evaluation.metrics_json["cer_score"].as_float()).label("avg_cer"),
            )
        elif battle_type == "s2s":
            metrics_stmt = metrics_stmt.add_columns(
                func.avg(Evaluation.metrics_json["prosody_score"].as_float()).label("avg_prosody"),
                func.avg(Evaluation.metrics_json["utmos"].as_float()).label("avg_utmos"),
            )

        metrics_row = (await db.execute(metrics_stmt)).one()

        snapshot = LeaderboardSnapshot(
            model_id=row.id,
            elo_rating=row.elo_rating,
            win_rate=row.win_rate,
            total_battles=row.total_battles,
            rank=rank,
            snapshot_date=today,
            battle_type=battle_type,
            avg_ttfb=metrics_row.avg_ttfb,
            avg_e2e_latency=metrics_row.avg_e2e_latency,
        )

        # Set mode-specific fields
        if battle_type == "tts":
            snapshot.avg_prosody = metrics_row.avg_prosody
            snapshot.avg_utmos = metrics_row.avg_utmos
        elif battle_type == "stt":
            snapshot.avg_wer = metrics_row.avg_wer
            snapshot.avg_cer = metrics_row.avg_cer
        elif battle_type == "s2s":
            snapshot.avg_prosody = metrics_row.avg_prosody
            snapshot.avg_utmos = metrics_row.avg_utmos

        db.add(snapshot)
        count += 1

    await db.commit()
    logger.info("Created %d %s snapshot records for %s", count, battle_type, today)
    return count


async def _snapshot_agent(db: AsyncSession, today: date) -> int:
    """Create snapshots for agent configurations."""
    stmt = (
        select(
            AgentConfiguration.id,
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
            func.avg(AgentConversation.avg_response_latency_ms).label("avg_e2e_latency"),
        )
        .outerjoin(AgentConversation, AgentConversation.agent_config_id == AgentConfiguration.id)
        .group_by(AgentConfiguration.id)
        .order_by(AgentConfiguration.elo_rating.desc())
    )
    result = await db.execute(stmt)
    rows = result.all()

    count = 0
    for rank, row in enumerate(rows, 1):
        snapshot = LeaderboardSnapshot(
            model_id=row.id,
            elo_rating=row.elo_rating,
            win_rate=row.win_rate,
            total_battles=row.total_battles,
            rank=rank,
            snapshot_date=today,
            battle_type="agent",
            avg_task_success_rate=row.avg_task_success_rate,
            avg_coherence=row.avg_coherence,
            avg_e2e_latency=row.avg_e2e_latency,
        )
        db.add(snapshot)
        count += 1

    await db.commit()
    logger.info("Created %d agent snapshot records for %s", count, today)
    return count
