# identity/app/features/usage/repository.py
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.features.usage.entity import UsageEvent


class UsageRepository:
    @staticmethod
    async def list_events(
        db: AsyncSession,
        user_id: uuid.UUID | None = None,
        event_type: str | None = None,
        offset: int = 0,
        limit: int = 50,
    ):
        stmt = select(UsageEvent)
        if user_id is not None:
            stmt = stmt.where(UsageEvent.user_id == user_id)
        if event_type is not None:
            stmt = stmt.where(UsageEvent.event_type == event_type)
        stmt = stmt.order_by(UsageEvent.created_at.desc()
                             ).offset(offset).limit(limit)

        result = await db.execute(stmt)
        return result.scalars().all()
