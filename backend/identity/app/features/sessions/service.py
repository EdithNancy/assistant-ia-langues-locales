from datetime import datetime, timezone
from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession  # <-- Modifié
from app.features.sessions.entity import UserSession
from app.core.pagination import apply_sort, paginated_response


class SessionService:
    @staticmethod
    async def list_own(
        db: AsyncSession,
        user_id,
        offset: int = 0,
        limit: int = 50,
        search: str | None = None,
        sort_by: str | None = None,
        sort_order: str | None = None,
        revoked: bool | None = None,
    ):
        statement = select(UserSession).where(UserSession.user_id == user_id)
        count_statement = (
            select(func.count())
            .select_from(UserSession)
            .where(UserSession.user_id == user_id)
        )
        if search:
            condition = UserSession.user_agent.ilike(f"%{search}%")
            statement = statement.where(condition)
            count_statement = count_statement.where(condition)
        if revoked is not None:
            condition = (
                UserSession.revoked_at.is_not(None)
                if revoked
                else UserSession.revoked_at.is_(None)
            )
            statement = statement.where(condition)
            count_statement = count_statement.where(condition)
        total = await db.scalar(count_statement)
        statement = apply_sort(
            statement,
            sort_by=sort_by,
            sort_order=sort_order,
            columns={
                "created_at": UserSession.created_at,
                "expires_at": UserSession.expires_at,
                "last_used_at": UserSession.last_used_at,
            },
            default="created_at",
            unique_column=UserSession.id,
        )
        result = await db.execute(  # <-- await + execute
            statement.offset(offset).limit(limit)
        )
        items = list(result.scalars().all())
        return paginated_response(items, total or 0, offset, limit)

    @staticmethod
    async def revoke_own(db: AsyncSession, session_id, user_id):  # <-- async def
        session = await db.get(UserSession, session_id)  # <-- await
        if session is None or session.user_id != user_id:
            raise HTTPException(404, "Session introuvable.")
        if session.revoked_at is None:
            session.revoked_at = datetime.now(timezone.utc)
            session.refresh_token_hash = None
        return session
