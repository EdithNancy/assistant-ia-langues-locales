from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import require_permission
from app.features.permissions.schemas import PermissionCreate, PermissionResponse
from app.features.permissions.service import PermissionService
from app.features.users.entity import User

router = APIRouter(prefix="/permissions", tags=["Permissions"])

@router.get("", response_model=list[PermissionResponse])
def list_permissions(db: Session = Depends(get_db), _: User = Depends(require_permission("permissions.read"))):
    return PermissionService.list_all(db)

@router.post("", response_model=PermissionResponse, status_code=201)
def create_permission(data: PermissionCreate, db: Session = Depends(get_db), _: User = Depends(require_permission("permissions.manage"))):
    return PermissionService.create(db, data)
