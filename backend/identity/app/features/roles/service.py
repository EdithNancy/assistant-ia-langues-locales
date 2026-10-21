from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession  # <-- Modifié
from app.features.roles.entity import Role
from app.features.roles.schemas import RoleCreate


class RoleService:
    @staticmethod
    async def list_all(db: AsyncSession):  # <-- async def
        result = await db.execute(  # <-- await + execute
            select(Role).order_by(Role.code)
        )
        return result.scalars().all()

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
