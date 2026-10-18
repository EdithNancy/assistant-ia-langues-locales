from dataclasses import dataclass

from fastapi import Header, HTTPException

from .usage_limits import is_free_user


@dataclass(frozen=True)
class CurrentUser:
    id: str
    role: str
    is_free: bool


async def current_user(
    x_user_id: str | None = Header(default=None),
    x_user_role: str | None = Header(default=None),
    x_user_roles: str | None = Header(default=None),
) -> CurrentUser:
    """L'identité est posée par la gateway (JWT déjà vérifié). Ce service ne voit que ces en-têtes."""
    if not x_user_id:
        raise HTTPException(401, "Identité manquante (appel hors gateway ?)")
    role = x_user_role or "user"
    return CurrentUser(
        id=x_user_id,
        role=role,
        is_free=is_free_user(role, x_user_roles),
    )
