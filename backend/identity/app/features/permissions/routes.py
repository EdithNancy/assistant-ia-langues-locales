from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession  # <-- Modifié
from app.core.database import get_db
from app.core.dependencies import require_permission
from app.features.permissions.schemas import PermissionCreate, PermissionResponse
from app.features.permissions.service import PermissionService
from app.features.users.entity import User

router = APIRouter(prefix="/permissions", tags=["Permissions"])


@router.get("", response_model=list[PermissionResponse])
async def list_permissions(  # <-- async def
    db: AsyncSession = Depends(get_db),  # <-- AsyncSession
    _: User = Depends(require_permission("permissions.read"))
):
    return await PermissionService.list_all(db)  # <-- await


@router.post("", response_model=PermissionResponse, status_code=201)
async def create_permission(  # <-- async def
    data: PermissionCreate,
    db: AsyncSession = Depends(get_db),  # <-- AsyncSession
    _: User = Depends(require_permission("permissions.manage"))
):
    return await PermissionService.create(db, data)  # <-- await
