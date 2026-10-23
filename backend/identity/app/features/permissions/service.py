from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession  # <-- Modifié
from app.core.pagination import apply_sort, paginated_response
from app.features.permissions.entity import Permission
from app.features.permissions.schemas import PermissionCreate


class PermissionService:
    @staticmethod
    async def list_all(
        db: AsyncSession,
        offset: int,
        limit: int,
        search: str | None = None,
        sort_by: str | None = None,
        sort_order: str | None = None,
    ):
        statement = select(Permission)
        count_statement = select(func.count()).select_from(Permission)
        if search:
            pattern = f"%{search}%"
            condition = (
                Permission.code.ilike(pattern) | Permission.name.ilike(pattern)
            )
            statement = statement.where(condition)
            count_statement = count_statement.where(condition)
        total = await db.scalar(count_statement)
        statement = apply_sort(
            statement,
            sort_by=sort_by,
            sort_order=sort_order,
            columns={"code": Permission.code, "name": Permission.name},
            default="code",
            unique_column=Permission.id,
            default_order="asc",
        )
        result = await db.execute(  # <-- await + execute
            statement.offset(offset).limit(limit)
        )
        return paginated_response(
            list(result.scalars().all()), total or 0, offset, limit
        )

    @staticmethod
    async def create(db: AsyncSession, data: PermissionCreate):  # <-- async def
        # Remplacement de db.query(...).first() par db.scalar(select(...))
        existing = await db.scalar(  # <-- await
            select(Permission).where(Permission.code == data.code)
        )
        if existing is not None:
            raise HTTPException(409, "Cette permission existe déjà.")

        item = Permission(code=data.code, name=data.name.strip(),
                          description=data.description)
        db.add(item)
        try:
            await db.commit()  # <-- await
            await db.refresh(item)  # <-- await
        except Exception:
            await db.rollback()  # <-- await
            raise
        return item
