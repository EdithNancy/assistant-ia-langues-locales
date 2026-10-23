import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from jose import jwt
from pwdlib import PasswordHash
from app.config import settings

_password_hash = PasswordHash.recommended()

def hash_password(password: str) -> str:
    return _password_hash.hash(password)

def verify_password(password: str, password_hash: str) -> bool:
    return _password_hash.verify(password, password_hash)

def create_access_token(user_id: str, session_id: str, roles: list[str]) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": user_id, "sid": session_id, "type": "access",
               "roles": sorted({role.lower() for role in roles}),
               "iat": now, "exp": now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)}
    if settings.JWT_AUDIENCE:
        payload["aud"] = settings.JWT_AUDIENCE
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    options = {"audience": settings.JWT_AUDIENCE} if settings.JWT_AUDIENCE else {}
    return jwt.decode(
        token,
        settings.JWT_SECRET_KEY,
        algorithms=[settings.JWT_ALGORITHM],
        **options,
    )

def new_refresh_token() -> str:
    return secrets.token_urlsafe(48)

def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()

def refresh_expiry():
    return datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
