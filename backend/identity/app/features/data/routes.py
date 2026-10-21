import uuid

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession  # <-- Modifié

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_permission
from app.features.data.schemas import (
    LanguageCreate,
    LanguageOut,
    VocabularyEntryCreate,
    VocabularyEntryOut,
    VocabularyEntryUpdate,
)
from app.features.data.service import DataService
from app.features.users.entity import User

router = APIRouter(prefix="/data", tags=["Language and vocabulary data"])


@router.get("/languages", response_model=list[LanguageOut])
async def list_languages(  # <-- async def
    active_only: bool = True,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),  # <-- AsyncSession
    _: User = Depends(get_current_user),
):
    # <-- await
    return await DataService.list_languages(db, active_only, offset, limit)


@router.post("/languages", response_model=LanguageOut, status_code=201)
async def create_language(  # <-- async def
    data: LanguageCreate,
    db: AsyncSession = Depends(get_db),  # <-- AsyncSession
    _: User = Depends(require_permission("data.manage")),
):
    return await DataService.create_language(db, data)  # <-- await


@router.get("/entries", response_model=list[VocabularyEntryOut])
async def list_entries(  # <-- async def
    source_language: str | None = Query(
        default=None, min_length=2, max_length=16),
    target_language: str | None = Query(
        default=None, min_length=2, max_length=16),
    q: str | None = Query(default=None, min_length=1, max_length=200),
    kind: str | None = Query(
        default=None, pattern="^(word|expression|sentence)$"),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),  # <-- AsyncSession
    _: User = Depends(get_current_user),
):
    return await DataService.list_entries(  # <-- await
        db, source_language, target_language, q, kind, offset, limit
    )


@router.post("/entries", response_model=VocabularyEntryOut, status_code=201)
async def create_entry(  # <-- async def
    data: VocabularyEntryCreate,
    db: AsyncSession = Depends(get_db),  # <-- AsyncSession
    user: User = Depends(require_permission("data.manage")),
):
    return await DataService.create_entry(db, data, user)  # <-- await


@router.patch("/entries/{entry_id}", response_model=VocabularyEntryOut)
async def update_entry(  # <-- async def
    entry_id: uuid.UUID,
    data: VocabularyEntryUpdate,
    db: AsyncSession = Depends(get_db),  # <-- AsyncSession
    _: User = Depends(require_permission("data.manage")),
):
    return await DataService.update_entry(db, entry_id, data)  # <-- await


@router.delete("/entries/{entry_id}", status_code=204)
async def delete_entry(  # <-- async def
    entry_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),  # <-- AsyncSession
    _: User = Depends(require_permission("data.manage")),
):
    await DataService.delete_entry(db, entry_id)  # <-- await
    return Response(status_code=204)
