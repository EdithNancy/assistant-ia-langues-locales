from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession  # <-- Modifié
from app.features.permissions.entity import Permission
from app.features.permissions.schemas import PermissionCreate


class PermissionService:
    @staticmethod
    async def list_all(db: AsyncSession):  # <-- async def
        result = await db.execute(  # <-- await + execute
            select(Permission).order_by(Permission.code)
        )
        return result.scalars().all()

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
