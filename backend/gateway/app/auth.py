from dataclasses import dataclass
import re
import uuid

import jwt
from fastapi import HTTPException

from .config import settings


@dataclass(frozen=True)
class User:
    id: str
    roles: frozenset[str]
    session_id: str

    @property
    def role(self) -> str:
        return min(self.roles, default="user")


def decode_token(token: str) -> User:
    try:
        payload = jwt.decode(
            token,
            settings.jwt_key,
            algorithms=[settings.jwt_algorithm],
            audience=settings.jwt_audience,
            options={"require": ["exp", "sub"], "verify_aud": settings.jwt_audience is not None},
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            401, "Token expiré", headers={"WWW-Authenticate": "Bearer"}
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            401, "Token invalide", headers={"WWW-Authenticate": "Bearer"}
        )
    subject = payload.get("sub")
    if not isinstance(subject, str) or not re.fullmatch(r"[A-Za-z0-9._:@+-]{1,128}", subject):
        raise HTTPException(401, "Sujet de jeton invalide", headers={"WWW-Authenticate": "Bearer"})
    try:
        session_id = str(uuid.UUID(payload["sid"]))
    except (KeyError, TypeError, ValueError, AttributeError):
        raise HTTPException(
            401, "Session de jeton invalide", headers={"WWW-Authenticate": "Bearer"}
        )
    raw_roles = payload.get("roles")
    if isinstance(raw_roles, list):
        if len(raw_roles) > 32 or any(
            not isinstance(role, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,64}", role)
            for role in raw_roles
        ):
            raise HTTPException(401, "Rôles de jeton invalides", headers={"WWW-Authenticate": "Bearer"})
        roles = frozenset(role.lower() for role in raw_roles)
    else:
        legacy_role = payload.get("role")
        if legacy_role is not None and (
            not isinstance(legacy_role, str)
            or not re.fullmatch(r"[A-Za-z0-9_-]{1,64}", legacy_role)
        ):
            raise HTTPException(401, "Rôle de jeton invalide", headers={"WWW-Authenticate": "Bearer"})
        roles = frozenset({legacy_role.lower()}) if isinstance(legacy_role, str) else frozenset()
    return User(id=subject, roles=roles, session_id=session_id)


def bearer(header: str | None) -> str | None:
    if header:
        parts = header.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            return parts[1]
    return None
