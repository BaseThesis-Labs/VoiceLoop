from sqlalchemy import String, Float, Integer
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin, generate_uuid


class AgentConfiguration(Base, TimestampMixin):
    __tablename__ = "agent_configurations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    name: Mapped[str] = mapped_column(String, nullable=False)
    architecture_type: Mapped[str] = mapped_column(String, nullable=False, default="cascade")
    provider: Mapped[str] = mapped_column(String, nullable=False)
    components_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    config_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    elo_rating: Mapped[float] = mapped_column(Float, default=1500.0)
    total_battles: Mapped[int] = mapped_column(Integer, default=0)
    win_rate: Mapped[float] = mapped_column(Float, default=0.0)
