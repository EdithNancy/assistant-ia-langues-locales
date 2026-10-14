import uuid

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

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
def list_languages(
    active_only: bool = True,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return DataService.list_languages(db, active_only, offset, limit)


@router.post("/languages", response_model=LanguageOut, status_code=201)
def create_language(
    data: LanguageCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("data.manage")),
):
    return DataService.create_language(db, data)


@router.get("/entries", response_model=list[VocabularyEntryOut])
def list_entries(
    source_language: str | None = Query(default=None, min_length=2, max_length=16),
    target_language: str | None = Query(default=None, min_length=2, max_length=16),
    q: str | None = Query(default=None, min_length=1, max_length=200),
    kind: str | None = Query(default=None, pattern="^(word|expression|sentence)$"),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return DataService.list_entries(
        db, source_language, target_language, q, kind, offset, limit
    )


@router.post("/entries", response_model=VocabularyEntryOut, status_code=201)
def create_entry(
    data: VocabularyEntryCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("data.manage")),
):
    return DataService.create_entry(db, data, user)


@router.patch("/entries/{entry_id}", response_model=VocabularyEntryOut)
def update_entry(
    entry_id: uuid.UUID,
    data: VocabularyEntryUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("data.manage")),
):
    return DataService.update_entry(db, entry_id, data)


@router.delete("/entries/{entry_id}", status_code=204)
def delete_entry(
    entry_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("data.manage")),
):
    DataService.delete_entry(db, entry_id)
    return Response(status_code=204)
