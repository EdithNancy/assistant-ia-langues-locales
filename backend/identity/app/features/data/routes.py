import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession  # <-- Modifié

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_permission
from app.core.pagination import (
    ListRequest,
    PaginatedResponse,
    get_data_list_request,
    paginated_response,
    validate_list_query,
)
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


@router.get("/languages", response_model=PaginatedResponse[LanguageOut])
async def list_languages(  # <-- async def
    http_request: Request,
    active_only: bool = True,
    request: ListRequest = Depends(get_data_list_request),
    db: AsyncSession = Depends(get_db),  # <-- AsyncSession
    _: User = Depends(get_current_user),
):
    validate_list_query(
        http_request, allowed_filters=frozenset({"active_only"})
    )
    # <-- await
    items, total = await DataService.list_languages(
        db,
        active_only,
        request.offset,
        request.limit,
        request.search,
        request.sort_by,
        request.sort_order,
    )
    return paginated_response(items, total, request.offset, request.limit)


@router.post("/languages", response_model=LanguageOut, status_code=201)
async def create_language(  # <-- async def
    data: LanguageCreate,
    db: AsyncSession = Depends(get_db),  # <-- AsyncSession
    _: User = Depends(require_permission("data.manage")),
):
    return await DataService.create_language(db, data)  # <-- await


@router.get("/entries", response_model=PaginatedResponse[VocabularyEntryOut])
async def list_entries(  # <-- async def
    http_request: Request,
    source_language: str | None = Query(
        default=None, min_length=2, max_length=16),
    target_language: str | None = Query(
        default=None, min_length=2, max_length=16),
    q: str | None = Query(default=None, min_length=1, max_length=200),
    kind: str | None = Query(
        default=None, pattern="^(word|expression|sentence)$"),
    request: ListRequest = Depends(get_data_list_request),
    db: AsyncSession = Depends(get_db),  # <-- AsyncSession
    _: User = Depends(get_current_user),
):
    validate_list_query(
        http_request,
        allowed_filters=frozenset(
            {"source_language", "target_language", "q", "kind"}
        ),
    )
    legacy_search = q.strip() if q and q.strip() else None
    if legacy_search is not None and request.search is not None:
        raise HTTPException(
            status_code=422,
            detail="Utilisez soit le paramètre « search », soit l'ancien « q », pas les deux.",
        )
    items, total = await DataService.list_entries(  # <-- await
        db,
        source_language,
        target_language,
        request.search or legacy_search,
        kind,
        request.offset,
        request.limit,
        request.sort_by,
        request.sort_order,
    )
    return paginated_response(items, total, request.offset, request.limit)


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
