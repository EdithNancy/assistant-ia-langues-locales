from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession  # <-- Modifié
from app.features.users.entity import User


class UserRepository:
    @staticmethod
    async def get_by_id(db: AsyncSession, user_id):
        return await db.get(User, user_id)  # <-- await

    @staticmethod
    async def get_by_email(db: AsyncSession, email: str):
        return await db.scalar(  # <-- await
            select(User).where(User.email == email.lower().strip())
        )

    @staticmethod
    async def list_users(db: AsyncSession, offset=0, limit=50):
        result = await db.scalars(  # <-- await
            select(User).order_by(User.created_at.desc()
                                  ).offset(offset).limit(limit)
        )
        return list(result.all())
