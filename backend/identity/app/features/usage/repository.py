import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession  # <-- Modifié

from app.features.usage.entity import UsageEvent
from app.core.pagination import apply_sort, paginated_response


class UsageRepository:
    @staticmethod
    async def list_events(  # <-- async def
        db: AsyncSession,  # <-- AsyncSession
        user_id: uuid.UUID | None,
        event_type: str | None,
        offset: int,
        limit: int,
        search: str | None = None,
        sort_by: str | None = None,
        sort_order: str | None = None,
    ):
        statement = select(UsageEvent)
        count_statement = select(func.count()).select_from(UsageEvent)
        if user_id is not None:
            statement = statement.where(UsageEvent.user_id == user_id)
            count_statement = count_statement.where(UsageEvent.user_id == user_id)
        if event_type is not None:
            statement = statement.where(UsageEvent.event_type == event_type)
            count_statement = count_statement.where(UsageEvent.event_type == event_type)
        if search:
            pattern = f"%{search}%"
            condition = (
                UsageEvent.route.ilike(pattern)
                | UsageEvent.method.ilike(pattern)
                | UsageEvent.event_type.ilike(pattern)
            )
            statement = statement.where(condition)
            count_statement = count_statement.where(condition)
        total = await db.scalar(count_statement)
        statement = apply_sort(
            statement,
            sort_by=sort_by,
            sort_order=sort_order,
            columns={
                "created_at": UsageEvent.created_at,
                "event_type": UsageEvent.event_type,
                "status_code": UsageEvent.status_code,
                "duration_ms": UsageEvent.duration_ms,
            },
            default="created_at",
            unique_column=UsageEvent.id,
        ).offset(offset).limit(limit)

        result = await db.execute(statement)  # <-- await + execute
        return paginated_response(
            list(result.scalars().all()), total or 0, offset, limit
        )
