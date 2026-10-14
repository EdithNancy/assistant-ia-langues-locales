import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _id() -> str:
    return uuid.uuid4().hex


class Scenario(Base):
    """Un exercice / cas pratique proposé aux pros."""
    __tablename__ = "scenarios"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_id)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    level: Mapped[str] = mapped_column(String(16), index=True)        # debutant | intermediaire | avance
    objectives: Mapped[list] = mapped_column(JSON, default=list)
    published: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Attempt(Base):
    """Une tentative d'un pro sur un scénario."""
    __tablename__ = "attempts"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_id)
    scenario_id: Mapped[str] = mapped_column(ForeignKey("scenarios.id"), index=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    status: Mapped[str] = mapped_column(String(16), default="in_progress")   # in_progress | completed
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)         # 0-100
    conversation_id: Mapped[str | None] = mapped_column(String(32), nullable=True)  # étape 2 : lien Conversation
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
