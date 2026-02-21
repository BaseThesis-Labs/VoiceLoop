from sqlalchemy import String, Float, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin, generate_uuid


class Prompt(Base, TimestampMixin):
    __tablename__ = "prompts"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=False)
    scenario_id: Mapped[str | None] = mapped_column(String, ForeignKey("scenarios.id"), nullable=True)
    audio_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    prompt_type: Mapped[str] = mapped_column(String, nullable=False, default="text")
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
