from sqlalchemy import String, Text, Integer
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin, generate_uuid


class Scenario(Base, TimestampMixin):
    __tablename__ = "scenarios"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    name: Mapped[str] = mapped_column(String, nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    difficulty: Mapped[str] = mapped_column(String, default="medium")
    ground_truth_transcript: Mapped[str | None] = mapped_column(Text, nullable=True)
    system_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    required_slots: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    success_criteria: Mapped[str | None] = mapped_column(Text, nullable=True)
    tools_available: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    max_turns: Mapped[int | None] = mapped_column(Integer, nullable=True, default=10)
    max_duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True, default=120)
