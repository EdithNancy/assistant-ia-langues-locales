import uuid

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_permission
from app.core.pagination import (
    ListRequest,
    PaginatedResponse,
    get_list_request,
    validate_list_query,
)
from app.features.usage.repository import UsageRepository
from app.features.usage.schemas import UsageEventResponse
from app.features.users.entity import User


# <-- CETTE LIGNE DOIT ÊTRE PRÉSENTE
router = APIRouter(prefix="/usage", tags=["Usage logs"])


@router.get("/events", response_model=PaginatedResponse[UsageEventResponse])
async def list_usage_events(
    http_request: Request,
    user_id: uuid.UUID | None = None,
    event_type: str | None = Query(default=None, min_length=1, max_length=80),
    request: ListRequest = Depends(get_list_request),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("usage.read")),
):
    validate_list_query(
        http_request, allowed_filters=frozenset({"user_id", "event_type"})
    )
    return await UsageRepository.list_events(
        db,
        user_id,
        event_type,
        request.offset,
        request.limit,
        request.search,
        request.sort_by,
        request.sort_order,
    )
