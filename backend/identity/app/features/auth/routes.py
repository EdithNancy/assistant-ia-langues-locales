import uuid
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.rate_limit import limiter
from app.core.revocation import revoke_access_sessions
from app.config import settings
from app.core.security import decode_token
from app.features.auth.schemas import (LoginRequest, RefreshRequest, SocialLoginRequest,
                                       SocialNonceRequest, SocialNonceResponse, TokenResponse)
from app.features.auth.service import AuthService
from app.features.users.entity import User
from app.features.users.schemas import UserRegister, UserResponse
from app.features.users.service import UserService
from app.features.auth.social import SocialAuthService

router = APIRouter(prefix="/auth", tags=["Authentication"])

def profile(user: User):
    return {"id": user.id, "full_name": user.full_name, "email": user.email,
            "phone_number": user.phone_number,
            "is_active": user.is_active, "is_verified": user.is_verified,
            "roles": [r.code for r in user.roles], "created_at": user.created_at}

@router.post("/register", response_model=UserResponse, status_code=201)
@limiter.limit(settings.RATE_LIMIT_AUTH, override_defaults=False)
def register(
    request: Request,
    response: Response,
    data: UserRegister,
    db: Session = Depends(get_db),
):
    return profile(UserService.register(db, data))

@router.post("/login", response_model=TokenResponse)
@limiter.limit(settings.RATE_LIMIT_AUTH, override_defaults=False)
def login(
    data: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    return AuthService.login(db, str(data.email).lower().strip(), data.password,
                             request.headers.get("user-agent"),
                             request.client.host if request.client else None)

@router.post("/social/nonce", response_model=SocialNonceResponse)
@limiter.limit(settings.RATE_LIMIT_SOCIAL_NONCE, override_defaults=False)
def social_nonce(
    request: Request,
    response: Response,
    data: SocialNonceRequest,
    db: Session = Depends(get_db),
):
    nonce = SocialAuthService.create_nonce(db, data.provider)
    return {"nonce": nonce, "expires_in": SocialAuthService.NONCE_TTL_SECONDS}

@router.post("/social/login", response_model=TokenResponse)
@limiter.limit(settings.RATE_LIMIT_AUTH, override_defaults=False)
def social_login(
    data: SocialLoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    user = SocialAuthService.login(db, data)
    return AuthService.create_session(
        db,
        user,
        request.headers.get("user-agent"),
        request.client.host if request.client else None,
    )

@router.post("/refresh", response_model=TokenResponse)
@limiter.limit(settings.RATE_LIMIT_AUTH, override_defaults=False)
def refresh(
    request: Request,
    response: Response,
    data: RefreshRequest,
    db: Session = Depends(get_db),
):
    return AuthService.refresh(db, data.refresh_token)

@router.post("/logout", status_code=204)
async def logout(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    scheme, _, token = request.headers.get("Authorization", "").partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(status_code=401, detail="Authentification requise.")
    payload = decode_token(token)
    session_id = uuid.UUID(payload["sid"])
    AuthService.logout(db, session_id, user.id)
    await revoke_access_sessions(request.app.state.redis, [session_id])
    db.commit()

@router.post("/logout-all", status_code=204)
async def logout_all(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session_ids = AuthService.logout_all(db, user.id)
    await revoke_access_sessions(request.app.state.redis, session_ids)
    db.commit()
