from datetime import datetime, timezone
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession  # <-- Modifié
from app.features.sessions.entity import UserSession


class SessionService:
    @staticmethod
    async def list_own(db: AsyncSession, user_id):  # <-- async def
        result = await db.execute(  # <-- await + execute
            select(UserSession)
            .where(UserSession.user_id == user_id)
            .order_by(UserSession.created_at.desc())
        )
        return result.scalars().all()

    @staticmethod
    async def revoke_own(db: AsyncSession, session_id, user_id):  # <-- async def
        session = await db.get(UserSession, session_id)  # <-- await
        if session is None or session.user_id != user_id:
            raise HTTPException(404, "Session introuvable.")
        if session.revoked_at is None:
            session.revoked_at = datetime.now(timezone.utc)
            session.refresh_token_hash = None
        return session
