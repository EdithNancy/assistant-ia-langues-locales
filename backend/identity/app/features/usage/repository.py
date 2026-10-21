import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession  # <-- Modifié

from app.features.usage.entity import UsageEvent


class UsageRepository:
    @staticmethod
    async def list_events(  # <-- async def
        db: AsyncSession,  # <-- AsyncSession
        user_id: uuid.UUID | None,
        event_type: str | None,
        offset: int,
        limit: int,
    ) -> list[UsageEvent]:
        statement = select(UsageEvent)
        if user_id is not None:
            statement = statement.where(UsageEvent.user_id == user_id)
        if event_type is not None:
            statement = statement.where(UsageEvent.event_type == event_type)
        statement = statement.order_by(
            UsageEvent.created_at.desc(), UsageEvent.id.desc()
        ).offset(offset).limit(limit)

        result = await db.execute(statement)  # <-- await + execute
        return list(result.scalars().all())
