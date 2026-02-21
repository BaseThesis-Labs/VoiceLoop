from sqlalchemy import String, Float, Integer, Boolean, Text, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin, generate_uuid


class AgentConversation(Base, TimestampMixin):
    __tablename__ = "agent_conversations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    battle_id: Mapped[str] = mapped_column(String, ForeignKey("battles.id"), nullable=False)
    agent_config_id: Mapped[str] = mapped_column(String, ForeignKey("agent_configurations.id"), nullable=False)
    scenario_id: Mapped[str] = mapped_column(String, ForeignKey("scenarios.id"), nullable=False)
    agent_label: Mapped[str] = mapped_column(String, nullable=False)
    turns_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    total_turns: Mapped[int | None] = mapped_column(Integer, nullable=True)
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    user_audio_path: Mapped[str | None] = mapped_column(String, nullable=True)
    agent_audio_path: Mapped[str | None] = mapped_column(String, nullable=True)
    transcript_full: Mapped[str | None] = mapped_column(Text, nullable=True)
    avg_response_latency_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    p50_latency_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    p95_latency_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    ttfb_avg_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    task_success: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    joint_goal_accuracy: Mapped[float | None] = mapped_column(Float, nullable=True)
    containment: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    turns_to_completion: Mapped[int | None] = mapped_column(Integer, nullable=True)
