import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class TokenWallet(Base):
    __tablename__ = "token_wallets"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    free_tokens_remaining: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    purchased_tokens_remaining: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    next_free_refill_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    user = relationship("User", back_populates="token_wallet")

    @staticmethod
    def next_refill_time() -> datetime:
        from app.config import settings

        return datetime.now(timezone.utc) + timedelta(days=settings.FREE_TOKEN_REFILL_DAYS)


class TokenTransaction(Base):
    __tablename__ = "token_transactions"
    __table_args__ = (UniqueConstraint("external_reference"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    bucket: Mapped[str] = mapped_column(String(16), nullable=False)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(String(32), nullable=False)
    external_reference: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
