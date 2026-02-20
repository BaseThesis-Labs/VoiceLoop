"""Experiment and Trial models for programmatic A/B testing."""
from sqlalchemy import String, Float, Integer, Text, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin, generate_uuid


class Experiment(Base, TimestampMixin):
    __tablename__ = "experiments"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    developer_id: Mapped[str] = mapped_column(String, ForeignKey("developers.id"), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    scenario: Mapped[str] = mapped_column(String, nullable=False)
    eval_mode: Mapped[str] = mapped_column(String, nullable=False, default="automated")
    status: Mapped[str] = mapped_column(String, nullable=False, default="created")
    models_json: Mapped[list] = mapped_column(JSONB, nullable=False)
    prompts_json: Mapped[list] = mapped_column(JSONB, nullable=False)
    webhook_url: Mapped[str | None] = mapped_column(String, nullable=True)
    total_trials: Mapped[int] = mapped_column(Integer, default=0)
    completed_trials: Mapped[int] = mapped_column(Integer, default=0)
    results_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)


class Trial(Base, TimestampMixin):
    __tablename__ = "trials"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    experiment_id: Mapped[str] = mapped_column(String, ForeignKey("experiments.id"), nullable=False)
    prompt_index: Mapped[int] = mapped_column(Integer, nullable=False)
    prompt_text: Mapped[str] = mapped_column(Text, nullable=False)
    provider: Mapped[str] = mapped_column(String, nullable=False)
    voice_id: Mapped[str] = mapped_column(String, nullable=False)
    model_id: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="pending")
    audio_path: Mapped[str | None] = mapped_column(String, nullable=True)
    audio_filename: Mapped[str | None] = mapped_column(String, nullable=True)
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    ttfb_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    generation_time_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    silence_ratio: Mapped[float | None] = mapped_column(Float, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
