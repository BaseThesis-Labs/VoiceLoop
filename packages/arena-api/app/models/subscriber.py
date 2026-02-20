"""Email subscriber model for newsletter/waitlist signups."""
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin, generate_uuid


class Subscriber(Base, TimestampMixin):
    __tablename__ = "subscribers"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    source: Mapped[str] = mapped_column(String, nullable=False, default="footer")
