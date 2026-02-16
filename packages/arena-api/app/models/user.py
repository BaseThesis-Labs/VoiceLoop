from sqlalchemy import String, Integer
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin, generate_uuid


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    session_token: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    votes_cast: Mapped[int] = mapped_column(Integer, default=0)
