import uuid
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession  # <-- Modifié
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_permission
from app.features.users.entity import User
from app.features.users.repository import UserRepository
from app.features.users.schemas import UserAdminResponse, UserResponse, UserUpdate
from app.features.users.service import UserService
from app.features.tokens.schemas import TokenBalanceResponse, TokenConsumptionRequest
from app.features.tokens.service import TokenService

router = APIRouter(prefix="/users", tags=["Users"])


def profile(user: User):
    return {"id": user.id, "full_name": user.full_name, "email": user.email,
            "phone_number": user.phone_number,
            "is_active": user.is_active, "is_verified": user.is_verified,
            "roles": [r.code for r in user.roles], "created_at": user.created_at}


@router.get("/me", response_model=UserResponse)
async def me(user: User = Depends(get_current_user)):  # <-- async def
    return profile(user)


@router.get("/me/tokens", response_model=TokenBalanceResponse)
async def token_balance(  # <-- async def
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)  # <-- AsyncSession
):
    return await TokenService.get_balance(db, user.id)  # <-- await


@router.post("/me/tokens/consume", response_model=TokenBalanceResponse)
async def consume_token_balance(  # <-- async def
    data: TokenConsumptionRequest,
    x_token_usage_source: str = Header(default=""),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),  # <-- AsyncSession
):
    if x_token_usage_source != "conversation":
        raise HTTPException(
            403, "Le débit de jetons est réservé au service Conversation.")
    # <-- await
    return await TokenService.consume_credit_tokens(db, user.id, data.credit_tokens)


@router.get("", response_model=list[UserAdminResponse])
async def list_users(  # <-- async def
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),  # <-- AsyncSession
    _: User = Depends(require_permission("users.read"))
):
    return await UserRepository.list_users(db, offset, limit)  # <-- await


@router.get("/{user_id}", response_model=UserAdminResponse)
async def get_user(  # <-- async def
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),  # <-- AsyncSession
    _: User = Depends(require_permission("users.read"))
):
    return await UserService.get_user(db, user_id)  # <-- await


@router.patch("/{user_id}", response_model=UserAdminResponse)
async def update_user(
    user_id: uuid.UUID,
    data: UserUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),  # <-- AsyncSession
    _: User = Depends(require_permission("users.update")),
):
    # <-- await
    return await UserService.update_user(db, user_id, data, request.app.state.redis)
