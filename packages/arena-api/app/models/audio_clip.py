import datetime

from sqlalchemy import String, Float, Text, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, generate_uuid


class AudioClip(Base):
    __tablename__ = "audio_clips"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    category: Mapped[str] = mapped_column(Text, nullable=False)
    difficulty: Mapped[str] = mapped_column(String, nullable=False, default="medium")
    ground_truth: Mapped[str] = mapped_column(Text, nullable=False)
    audio_path: Mapped[str] = mapped_column(Text, nullable=False)
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    tags: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow
    )
