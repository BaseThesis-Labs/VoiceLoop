from sqlalchemy import String, Float, Text, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin, generate_uuid


class Evaluation(Base, TimestampMixin):
    __tablename__ = "evaluations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    model_id: Mapped[str] = mapped_column(String, ForeignKey("models.id"), nullable=False)
    scenario_id: Mapped[str | None] = mapped_column(String, ForeignKey("scenarios.id"), nullable=True)
    status: Mapped[str] = mapped_column(String, default="pending")
    audio_path: Mapped[str] = mapped_column(String, nullable=False)
    transcript_ref: Mapped[str | None] = mapped_column(Text, nullable=True)
    metrics_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    diarization_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
