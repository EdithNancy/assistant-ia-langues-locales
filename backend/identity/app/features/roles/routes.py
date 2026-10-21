from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession  # <-- Modifié
from app.core.database import get_db
from app.core.dependencies import require_permission
from app.features.roles.schemas import RoleCreate, RoleResponse
from app.features.roles.service import RoleService
from app.features.users.entity import User

router = APIRouter(prefix="/roles", tags=["Roles"])


@router.get("", response_model=list[RoleResponse])
async def list_roles(  # <-- async def
    db: AsyncSession = Depends(get_db),  # <-- AsyncSession
    _: User = Depends(require_permission("roles.read"))
):
    return await RoleService.list_all(db)  # <-- await


@router.post("", response_model=RoleResponse, status_code=201)
async def create_role(  # <-- async def
    data: RoleCreate,
    db: AsyncSession = Depends(get_db),  # <-- AsyncSession
    _: User = Depends(require_permission("roles.manage"))
):
    return await RoleService.create(db, data)  # <-- await
