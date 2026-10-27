from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException


@dataclass(frozen=True)
class CurrentUser:
    id: str
    roles: frozenset[str]


async def current_user(
    x_user_id: str | None = Header(default=None),
    x_user_role: str | None = Header(default=None),
    x_user_roles: str | None = Header(default=None),
) -> CurrentUser:
    if not x_user_id:
        raise HTTPException(401, "Identité manquante (appel hors gateway ?)")
    roles = frozenset(
        role.strip().lower()
        for role in (x_user_roles or "").split(",")
        if role.strip()
    )
    if not roles and x_user_role:
        roles = frozenset({x_user_role.lower()})
    return CurrentUser(id=x_user_id, roles=roles)


def require_roles(*roles: str):
    """Défense en profondeur : la gateway filtre déjà, le service revérifie."""
    async def dep(user: CurrentUser = Depends(current_user)) -> CurrentUser:
        if not user.roles.intersection(role.lower() for role in roles):
            raise HTTPException(403, "Accès refusé pour ce rôle")
        return user
    return dep


pro_or_admin = require_roles("pro", "admin", "super_admin")
admin_only = require_roles("admin", "super_admin")
