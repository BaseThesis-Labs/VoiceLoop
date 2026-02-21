from datetime import date
from sqlalchemy import String, Float, Integer, Date, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, generate_uuid


class LeaderboardSnapshot(Base):
    __tablename__ = "leaderboard_snapshots"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    model_id: Mapped[str] = mapped_column(String, ForeignKey("models.id"), nullable=False)
    elo_rating: Mapped[float] = mapped_column(Float, nullable=False)
    win_rate: Mapped[float] = mapped_column(Float, default=0.0)
    total_battles: Mapped[int] = mapped_column(Integer, default=0)
    avg_wer: Mapped[float | None] = mapped_column(Float, nullable=True)
    avg_semascore: Mapped[float | None] = mapped_column(Float, nullable=True)
    avg_prosody: Mapped[float | None] = mapped_column(Float, nullable=True)
    avg_quality: Mapped[float | None] = mapped_column(Float, nullable=True)
    rank: Mapped[int] = mapped_column(Integer, nullable=False)
    snapshot_date: Mapped[date] = mapped_column(Date, nullable=False)
    battle_type: Mapped[str] = mapped_column(String, nullable=False, default="tts")
