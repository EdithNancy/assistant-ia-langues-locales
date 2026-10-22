from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession  # <-- Modifié
from app.core.pagination import apply_sort, paginated_response
from app.features.roles.entity import Role
from app.features.roles.schemas import RoleCreate


class RoleService:
    @staticmethod
    async def list_all(
        db: AsyncSession,
        offset: int,
        limit: int,
        search: str | None = None,
        sort_by: str | None = None,
        sort_order: str | None = None,
    ):
        statement = select(Role)
        count_statement = select(func.count()).select_from(Role)
        if search:
            pattern = f"%{search}%"
            condition = Role.code.ilike(pattern) | Role.name.ilike(pattern)
            statement = statement.where(condition)
            count_statement = count_statement.where(condition)
        total = await db.scalar(count_statement)
        statement = apply_sort(
            statement,
            sort_by=sort_by,
            sort_order=sort_order,
            columns={"code": Role.code, "name": Role.name},
            default="code",
            unique_column=Role.id,
            default_order="asc",
        )
        result = await db.execute(  # <-- await + execute
            statement.offset(offset).limit(limit)
        )
        return paginated_response(
            list(result.scalars().all()), total or 0, offset, limit
        )

    @staticmethod
    async def create(db: AsyncSession, data: RoleCreate):  # <-- async def
        # Remplacement de db.query(...).first() par db.scalar(select(...))
        existing = await db.scalar(  # <-- await
            select(Role).where(Role.code == data.code)
        )
        if existing is not None:
            raise HTTPException(409, "Ce rôle existe déjà.")

        role = Role(code=data.code, name=data.name.strip(),
                    description=data.description)
        db.add(role)
        try:
            await db.commit()  # <-- await
            await db.refresh(role)  # <-- await
        except Exception:
            await db.rollback()  # <-- await
            raise
        return role
