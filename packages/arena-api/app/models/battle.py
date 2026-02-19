from sqlalchemy import String, Float, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin, generate_uuid


class Battle(Base, TimestampMixin):
    __tablename__ = "battles"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    scenario_id: Mapped[str] = mapped_column(String, ForeignKey("scenarios.id"), nullable=False)
    model_a_id: Mapped[str] = mapped_column(String, ForeignKey("models.id"), nullable=False)
    model_b_id: Mapped[str] = mapped_column(String, ForeignKey("models.id"), nullable=False)
    eval_a_id: Mapped[str | None] = mapped_column(String, ForeignKey("evaluations.id"), nullable=True)
    eval_b_id: Mapped[str | None] = mapped_column(String, ForeignKey("evaluations.id"), nullable=True)
    model_c_id: Mapped[str | None] = mapped_column(String, ForeignKey("models.id"), nullable=True)
    model_d_id: Mapped[str | None] = mapped_column(String, ForeignKey("models.id"), nullable=True)
    eval_c_id: Mapped[str | None] = mapped_column(String, ForeignKey("evaluations.id"), nullable=True)
    eval_d_id: Mapped[str | None] = mapped_column(String, ForeignKey("evaluations.id"), nullable=True)
    winner: Mapped[str | None] = mapped_column(String, nullable=True)
    vote_source: Mapped[str | None] = mapped_column(String, nullable=True)
    elo_delta: Mapped[float | None] = mapped_column(Float, nullable=True)
