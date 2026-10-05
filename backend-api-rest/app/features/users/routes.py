import uuid
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_permission
from app.features.users.entity import User
from app.features.users.repository import UserRepository
from app.features.users.schemas import UserAdminResponse, UserResponse, UserUpdate
from app.features.users.service import UserService
from app.features.tokens.schemas import TokenBalanceResponse
from app.features.tokens.service import TokenService

router = APIRouter(prefix="/users", tags=["Users"])

def profile(user: User):
    return {"id": user.id, "full_name": user.full_name, "email": user.email,
            "phone_number": user.phone_number,
            "is_active": user.is_active, "is_verified": user.is_verified,
            "roles": [r.code for r in user.roles], "created_at": user.created_at}

@router.get("/me", response_model=UserResponse)
def me(user: User = Depends(get_current_user)):
    return profile(user)

@router.get("/me/tokens", response_model=TokenBalanceResponse)
def token_balance(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return TokenService.get_balance(db, user.id)

@router.get("", response_model=list[UserAdminResponse])
def list_users(offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=100),
               db: Session = Depends(get_db), _: User = Depends(require_permission("users.read"))):
    return UserRepository.list_users(db, offset, limit)

@router.get("/{user_id}", response_model=UserAdminResponse)
def get_user(user_id: uuid.UUID, db: Session = Depends(get_db),
             _: User = Depends(require_permission("users.read"))):
    return UserService.get_user(db, user_id)

@router.patch("/{user_id}", response_model=UserAdminResponse)
def update_user(user_id: uuid.UUID, data: UserUpdate, db: Session = Depends(get_db),
                _: User = Depends(require_permission("users.update"))):
    return UserService.update_user(db, user_id, data)
