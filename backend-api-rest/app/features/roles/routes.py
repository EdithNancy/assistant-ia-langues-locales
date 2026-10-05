from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import require_permission
from app.features.roles.schemas import RoleCreate, RoleResponse
from app.features.roles.service import RoleService
from app.features.users.entity import User

router = APIRouter(prefix="/roles", tags=["Roles"])

@router.get("", response_model=list[RoleResponse])
def list_roles(db: Session = Depends(get_db), _: User = Depends(require_permission("roles.read"))):
    return RoleService.list_all(db)

@router.post("", response_model=RoleResponse, status_code=201)
def create_role(data: RoleCreate, db: Session = Depends(get_db), _: User = Depends(require_permission("roles.manage"))):
    return RoleService.create(db, data)
