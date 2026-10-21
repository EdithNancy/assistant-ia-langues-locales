import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_permission
from app.features.usage.repository import UsageRepository
from app.features.usage.schemas import UsageEventResponse
from app.features.users.entity import User


# <-- CETTE LIGNE DOIT ÊTRE PRÉSENTE
router = APIRouter(prefix="/usage", tags=["Usage logs"])


@router.get("/events", response_model=list[UsageEventResponse])
async def list_usage_events(
    user_id: uuid.UUID | None = None,
    event_type: str | None = Query(default=None, min_length=1, max_length=80),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("usage.read")),
):
    return await UsageRepository.list_events(
        db, user_id, event_type, offset, limit
    )
