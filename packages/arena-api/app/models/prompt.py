from sqlalchemy import String, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin, generate_uuid


class Prompt(Base, TimestampMixin):
    __tablename__ = "prompts"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=False)
    scenario_id: Mapped[str | None] = mapped_column(String, ForeignKey("scenarios.id"), nullable=True)
