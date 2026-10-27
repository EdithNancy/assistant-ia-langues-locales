from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession  # <-- Modifié
from app.core.pagination import apply_sort
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
    async def get_by_phone_number(db: AsyncSession, phone_number: str):
        result = await db.scalars(
            select(User).where(User.phone_number == phone_number).limit(2)
        )
        users = result.all()
        return users[0] if len(users) == 1 else None

    @staticmethod
    async def list_users(
        db: AsyncSession,
        offset=0,
        limit=50,
        search: str | None = None,
        sort_by: str | None = None,
        sort_order: str | None = None,
        is_active: bool | None = None,
    ):
        statement = select(User)
        count_statement = select(func.count()).select_from(User)
        conditions = []
        if search:
            pattern = f"%{search}%"
            conditions.append(
                or_(User.full_name.ilike(pattern), User.email.ilike(pattern))
            )
        if is_active is not None:
            conditions.append(User.is_active.is_(is_active))
        statement = statement.where(*conditions)
        count_statement = count_statement.where(*conditions)
        total = await db.scalar(count_statement)
        statement = apply_sort(
            statement,
            sort_by=sort_by,
            sort_order=sort_order,
            columns={
                "full_name": User.full_name,
                "email": User.email,
                "created_at": User.created_at,
            },
            default="created_at",
            unique_column=User.id,
        )
        result = await db.scalars(  # <-- await
            statement.offset(offset).limit(limit)
        )
        return list(result.all()), total or 0
