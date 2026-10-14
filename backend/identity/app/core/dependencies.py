import uuid
from datetime import datetime, timezone
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import decode_token
from app.features.users.entity import User
from app.features.sessions.entity import UserSession

bearer_scheme = HTTPBearer(bearerFormat="JWT", auto_error=False)

def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    error = HTTPException(status_code=401, detail="Authentification requise ou jeton invalide.",
                          headers={"WWW-Authenticate": "Bearer"})
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise error
    try:
        payload = decode_token(credentials.credentials)
        if payload.get("type") != "access":
            raise error
        user_id, session_id = uuid.UUID(payload["sub"]), uuid.UUID(payload["sid"])
    except (JWTError, ValueError, KeyError, TypeError):
        raise error
    user, session = db.get(User, user_id), db.get(UserSession, session_id)
    now = datetime.now(timezone.utc)
    if (user is None or not user.is_active or session is None
            or session.user_id != user.id or session.revoked_at is not None):
        raise error
    expires_at = session.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= now:
        raise error
    return user

def require_permission(code: str):
    def checker(user: User = Depends(get_current_user)) -> User:
        permissions = {p.code for role in user.roles for p in role.permissions}
        if code not in permissions and "permissions.manage_all" not in permissions:
            raise HTTPException(status_code=403, detail="Permission insuffisante.")
        return user
    return checker
