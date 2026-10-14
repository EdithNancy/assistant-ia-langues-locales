from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, aliased, joinedload

from app.features.data.entity import Language, VocabularyEntry
from app.features.data.schemas import (
    LanguageCreate,
    VocabularyEntryCreate,
    VocabularyEntryUpdate,
)
from app.features.users.entity import User


class DataService:
    @staticmethod
    def create_language(db: Session, data: LanguageCreate) -> Language:
        code = data.code.strip().lower()
        if db.scalar(select(Language.id).where(Language.code == code)):
            raise HTTPException(status_code=409, detail="Cette langue existe déjà.")
        language = Language(
            code=code,
            name=data.name.strip(),
            native_name=data.native_name.strip() if data.native_name else None,
        )
        db.add(language)
        db.commit()
        db.refresh(language)
        return language

    @staticmethod
    def list_languages(
        db: Session, active_only: bool = True, offset: int = 0, limit: int = 100
    ) -> list[Language]:
        query = select(Language).order_by(Language.name).offset(offset).limit(limit)
        if active_only:
            query = query.where(Language.is_active.is_(True))
        return list(db.scalars(query).all())

    @staticmethod
    def get_language(db: Session, language_id: UUID) -> Language:
        language = db.get(Language, language_id)
        if language is None:
            raise HTTPException(status_code=404, detail="Langue introuvable.")
        return language

    @staticmethod
    def create_entry(
        db: Session, data: VocabularyEntryCreate, user: User
    ) -> VocabularyEntry:
        if data.source_language_id == data.target_language_id:
            raise HTTPException(status_code=422, detail="Les langues doivent être différentes.")
        languages = db.scalars(
            select(Language).where(
                Language.id.in_({data.source_language_id, data.target_language_id}),
                Language.is_active.is_(True),
            )
        ).all()
        if len(languages) != 2:
            raise HTTPException(status_code=422, detail="Langue source ou cible introuvable.")
        entry = VocabularyEntry(
            **data.model_dump(),
            created_by=user.id,
        )
        db.add(entry)
        db.commit()
        return db.scalar(
            select(VocabularyEntry)
            .options(
                joinedload(VocabularyEntry.source_language),
                joinedload(VocabularyEntry.target_language),
            )
            .where(VocabularyEntry.id == entry.id)
        )

    @staticmethod
    def list_entries(
        db: Session,
        source_code: str | None = None,
        target_code: str | None = None,
        search: str | None = None,
        kind: str | None = None,
        offset: int = 0,
        limit: int = 100,
    ) -> list[VocabularyEntry]:
        query = (
            select(VocabularyEntry)
            .join(
                Language,
                VocabularyEntry.source_language_id == Language.id,
            )
            .options(
                joinedload(VocabularyEntry.source_language),
                joinedload(VocabularyEntry.target_language),
            )
            .order_by(VocabularyEntry.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        if source_code:
            query = query.where(Language.code == source_code.strip().lower())
        if target_code:
            target_language = aliased(Language)
            query = query.join(
                target_language,
                VocabularyEntry.target_language_id == target_language.id,
            ).where(target_language.code == target_code.strip().lower())
        if search:
            pattern = f"%{search.strip()}%"
            query = query.where(
                VocabularyEntry.source_text.ilike(pattern)
                | VocabularyEntry.target_text.ilike(pattern)
            )
        if kind:
            query = query.where(VocabularyEntry.kind == kind)
        return list(db.scalars(query).unique().all())

    @staticmethod
    def update_entry(
        db: Session, entry_id: UUID, data: VocabularyEntryUpdate
    ) -> VocabularyEntry:
        entry = db.scalar(
            select(VocabularyEntry)
            .options(
                joinedload(VocabularyEntry.source_language),
                joinedload(VocabularyEntry.target_language),
            )
            .where(VocabularyEntry.id == entry_id)
        )
        if entry is None:
            raise HTTPException(status_code=404, detail="Entrée introuvable.")
        updates = data.model_dump(exclude_unset=True)
        source_id = updates.get("source_language_id", entry.source_language_id)
        target_id = updates.get("target_language_id", entry.target_language_id)
        if source_id is None or target_id is None or source_id == target_id:
            raise HTTPException(status_code=422, detail="Les langues doivent être différentes.")
        example_source = updates.get("example_source", entry.example_source)
        example_target = updates.get("example_target", entry.example_target)
        if (example_source is None) != (example_target is None):
            raise HTTPException(
                status_code=422,
                detail="Les exemples source et cible doivent être fournis ensemble.",
            )
        for field, value in updates.items():
            setattr(entry, field, value)
        db.commit()
        db.refresh(entry)
        return entry

    @staticmethod
    def delete_entry(db: Session, entry_id: UUID) -> None:
        entry = db.get(VocabularyEntry, entry_id)
        if entry is None:
            raise HTTPException(status_code=404, detail="Entrée introuvable.")
        db.delete(entry)
        db.commit()
