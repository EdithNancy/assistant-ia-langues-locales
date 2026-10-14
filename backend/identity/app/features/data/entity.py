import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Language(Base):
    __tablename__ = "languages"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(16), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    native_name: Mapped[str | None] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    source_entries = relationship(
        "VocabularyEntry",
        foreign_keys="VocabularyEntry.source_language_id",
        back_populates="source_language",
    )
    target_entries = relationship(
        "VocabularyEntry",
        foreign_keys="VocabularyEntry.target_language_id",
        back_populates="target_language",
    )


class VocabularyEntry(Base):
    __tablename__ = "vocabulary_entries"
    __table_args__ = (
        CheckConstraint(
            "kind IN ('word', 'expression', 'sentence')",
            name="ck_vocabulary_entries_kind",
        ),
        CheckConstraint(
            "source_language_id <> target_language_id",
            name="ck_vocabulary_entries_different_languages",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    source_language_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("languages.id", ondelete="RESTRICT"), index=True, nullable=False
    )
    target_language_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("languages.id", ondelete="RESTRICT"), index=True, nullable=False
    )
    source_text: Mapped[str] = mapped_column(String(500), nullable=False)
    target_text: Mapped[str] = mapped_column(String(1000), nullable=False)
    kind: Mapped[str] = mapped_column(String(16), nullable=False, default="word")
    pronunciation: Mapped[str | None] = mapped_column(String(500))
    example_source: Mapped[str | None] = mapped_column(Text)
    example_target: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    source_language = relationship(
        "Language", foreign_keys=[source_language_id], back_populates="source_entries"
    )
    target_language = relationship(
        "Language", foreign_keys=[target_language_id], back_populates="target_entries"
    )
