from sqlalchemy import String, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin, generate_uuid


class AgentBattle(Base, TimestampMixin):
    __tablename__ = "agent_battles"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    battle_id: Mapped[str] = mapped_column(String, ForeignKey("battles.id"), nullable=False)
    formulation: Mapped[str] = mapped_column(String, nullable=False, default="outcome")
    scenario_id: Mapped[str] = mapped_column(String, ForeignKey("scenarios.id"), nullable=False)
    config_a_id: Mapped[str] = mapped_column(String, ForeignKey("agent_configurations.id"), nullable=False)
    config_b_id: Mapped[str] = mapped_column(String, ForeignKey("agent_configurations.id"), nullable=False)
    conversation_a_id: Mapped[str | None] = mapped_column(String, ForeignKey("agent_conversations.id"), nullable=True)
    conversation_b_id: Mapped[str | None] = mapped_column(String, ForeignKey("agent_conversations.id"), nullable=True)
    sub_votes_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    automated_eval_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
