from dataclasses import dataclass

from fastapi import Header, HTTPException


@dataclass(frozen=True)
class CurrentUser:
    id: str
    role: str


async def current_user(
    x_user_id: str | None = Header(default=None),
    x_user_role: str | None = Header(default=None),
) -> CurrentUser:
    """L'identité est posée par la gateway (JWT déjà vérifié). Ce service ne voit que ces en-têtes."""
    if not x_user_id:
        raise HTTPException(401, "Identité manquante (appel hors gateway ?)")
    return CurrentUser(id=x_user_id, role=x_user_role or "user")
