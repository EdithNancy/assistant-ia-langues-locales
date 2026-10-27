from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession  # <-- Modifié
from sqlalchemy.orm import aliased, joinedload

from app.core.pagination import apply_sort
from app.features.data.entity import Language, VocabularyEntry
from app.features.data.schemas import (
    LanguageCreate,
    VocabularyEntryCreate,
    VocabularyEntryUpdate,
)
from app.features.users.entity import User


class DataService:
    @staticmethod
    # <-- async def
    async def create_language(db: AsyncSession, data: LanguageCreate) -> Language:
        code = data.code.strip().lower()

        # db.scalar(...) doit être awaité
        if await db.scalar(select(Language.id).where(Language.code == code)):  # <-- await
            raise HTTPException(
                status_code=409, detail="Cette langue existe déjà.")

        language = Language(
            code=code,
            name=data.name.strip(),
            native_name=data.native_name.strip() if data.native_name else None,
        )
        db.add(language)
        await db.commit()  # <-- await
        await db.refresh(language)  # <-- await
        return language

    @staticmethod
    async def list_languages(  # <-- async def
        db: AsyncSession,
        active_only: bool = True,
        offset: int = 0,
        limit: int = 100,
        search: str | None = None,
        sort_by: str | None = None,
        sort_order: str | None = None,
    ) -> tuple[list[Language], int]:
        query = select(Language)
        count_query = select(func.count()).select_from(Language)
        if active_only:
            query = query.where(Language.is_active.is_(True))
            count_query = count_query.where(Language.is_active.is_(True))
        if search:
            pattern = f"%{search}%"
            condition = Language.name.ilike(pattern) | Language.code.ilike(pattern)
            query = query.where(condition)
            count_query = count_query.where(condition)

        total = await db.scalar(count_query)
        query = apply_sort(
            query,
            sort_by=sort_by,
            sort_order=sort_order,
            columns={
                "name": Language.name,
                "code": Language.code,
                "created_at": Language.created_at,
            },
            default="name",
            unique_column=Language.id,
            default_order="asc",
        )
        result = await db.execute(
            query.offset(offset).limit(limit)
        )
        return list(result.scalars().all()), total or 0

    @staticmethod
    async def get_language(db: AsyncSession, language_id: UUID) -> Language:  # <-- async def
        language = await db.get(Language, language_id)  # <-- await
        if language is None:
            raise HTTPException(status_code=404, detail="Langue introuvable.")
        return language

    @staticmethod
    async def create_entry(  # <-- async def
        db: AsyncSession, data: VocabularyEntryCreate, user: User
    ) -> VocabularyEntry:
        if data.source_language_id == data.target_language_id:
            raise HTTPException(
                status_code=422, detail="Les langues doivent être différentes.")

        # Correction : on ne peut pas faire await db.scalars(...) directement
        result = await db.execute(  # <-- await + execute
            select(Language).where(
                Language.id.in_(
                    {data.source_language_id, data.target_language_id}),
                Language.is_active.is_(True),
            )
        )
        languages = result.scalars().all()

        if len(languages) != 2:
            raise HTTPException(
                status_code=422, detail="Langue source ou cible introuvable.")
        entry = VocabularyEntry(
            **data.model_dump(),
            created_by=user.id,
        )
        db.add(entry)
        await db.commit()  # <-- await

        # Retourne l'entrée avec les relations chargées
        return await db.scalar(  # <-- await
            select(VocabularyEntry)
            .options(
                joinedload(VocabularyEntry.source_language),
                joinedload(VocabularyEntry.target_language),
            )
            .where(VocabularyEntry.id == entry.id)
        )

    @staticmethod
    async def list_entries(  # <-- async def
        db: AsyncSession,
        source_code: str | None = None,
        target_code: str | None = None,
        search: str | None = None,
        kind: str | None = None,
        offset: int = 0,
        limit: int = 100,
        sort_by: str | None = None,
        sort_order: str | None = None,
    ) -> tuple[list[VocabularyEntry], int]:
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
        )
        conditions = []
        if source_code:
            conditions.append(Language.code == source_code.strip().lower())
        if target_code:
            target_language = aliased(Language)
            query = query.join(
                target_language,
                VocabularyEntry.target_language_id == target_language.id,
            )
            conditions.append(target_language.code == target_code.strip().lower())
        if search:
            pattern = f"%{search.strip()}%"
            conditions.append(
                VocabularyEntry.source_text.ilike(pattern)
                | VocabularyEntry.target_text.ilike(pattern)
            )
        if kind:
            conditions.append(VocabularyEntry.kind == kind)

        query = query.where(*conditions)
        count_query = (
            select(func.count(VocabularyEntry.id))
            .select_from(VocabularyEntry)
            .join(Language, VocabularyEntry.source_language_id == Language.id)
        )
        if target_code:
            count_query = count_query.join(
                target_language,
                VocabularyEntry.target_language_id == target_language.id,
            )
        count_query = count_query.where(*conditions)
        total = await db.scalar(count_query)
        query = apply_sort(
            query,
            sort_by=sort_by,
            sort_order=sort_order,
            columns={
                "created_at": VocabularyEntry.created_at,
                "source_text": VocabularyEntry.source_text,
                "target_text": VocabularyEntry.target_text,
                "kind": VocabularyEntry.kind,
            },
            default="created_at",
            unique_column=VocabularyEntry.id,
        )
        result = await db.execute(
            query.offset(offset).limit(limit)
        )
        return list(result.scalars().unique().all()), total or 0

    @staticmethod
    async def update_entry(  # <-- async def
        db: AsyncSession, entry_id: UUID, data: VocabularyEntryUpdate
    ) -> VocabularyEntry:
        entry = await db.scalar(  # <-- await
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
            raise HTTPException(
                status_code=422, detail="Les langues doivent être différentes.")
        example_source = updates.get("example_source", entry.example_source)
        example_target = updates.get("example_target", entry.example_target)
        if (example_source is None) != (example_target is None):
            raise HTTPException(
                status_code=422,
                detail="Les exemples source et cible doivent être fournis ensemble.",
            )
        for field, value in updates.items():
            setattr(entry, field, value)
        await db.commit()  # <-- await
        await db.refresh(entry)  # <-- await
        return entry

    @staticmethod
    async def delete_entry(db: AsyncSession, entry_id: UUID) -> None:  # <-- async def
        entry = await db.get(VocabularyEntry, entry_id)  # <-- await
        if entry is None:
            raise HTTPException(status_code=404, detail="Entrée introuvable.")
        await db.delete(entry)  # <-- await
        await db.commit()  # <-- await
