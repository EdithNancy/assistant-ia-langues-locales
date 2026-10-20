import asyncio

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import SessionLocal

# Charger tous les modèles SQLAlchemy avant les requêtes
from app.features.users.entity import User  # noqa: F401
from app.features.sessions.entity import UserSession  # noqa: F401
from app.features.roles.entity import Role
from app.features.permissions.entity import Permission
from app.features.auth.social import FederatedIdentity  # noqa: F401

PERMISSIONS = [
    ("users.read", "Lire les utilisateurs"), ("users.create", "Créer des utilisateurs"),
    ("users.update", "Modifier les utilisateurs"), ("users.disable",
                                                    "Désactiver les utilisateurs"),
    ("roles.read", "Lire les rôles"), ("roles.manage", "Gérer les rôles"),
    ("permissions.read", "Lire les permissions"), ("permissions.manage",
                                                   "Gérer les permissions"),
    ("sessions.read_all", "Lire toutes les sessions"), ("sessions.revoke_all",
                                                        "Révoquer toutes les sessions"),
    ("corpus.validate", "Valider le corpus"), ("assistant.use", "Utiliser l'assistant"),
    ("data.manage", "Gérer les langues et le vocabulaire"),
    ("usage.read", "Consulter les journaux d'utilisation"),
    ("permissions.manage_all", "Accès total"),
]
ROLE_PERMISSIONS = {
    "USER": ["assistant.use"],
    "PRO": ["assistant.use"],
    "LINGUIST": ["assistant.use", "corpus.validate", "data.manage"],
    "MODERATOR": ["assistant.use", "users.read", "data.manage"],
    "ADMIN": ["users.read", "users.create", "users.update", "users.disable", "roles.read",
              "roles.manage", "permissions.read", "sessions.read_all", "sessions.revoke_all",
              "data.manage", "usage.read"],
    "SUPER_ADMIN": [p[0] for p in PERMISSIONS],
}
ROLE_NAMES = {"USER": "Utilisateur", "LINGUIST": "Linguiste", "MODERATOR": "Modérateur",
              "PRO": "Professionnel", "ADMIN": "Administrateur", "SUPER_ADMIN": "Super administrateur"}


async def main():
    async with SessionLocal() as db:
        permissions = {}
        for code, name in PERMISSIONS:
            result = await db.execute(select(Permission).filter_by(code=code))
            obj = result.scalar_one_or_none()
            if obj is None:
                obj = Permission(code=code, name=name)
                db.add(obj)
            permissions[code] = obj
        await db.flush()

        for code, name in ROLE_NAMES.items():
            result = await db.execute(
                select(Role)
                .options(selectinload(Role.permissions))
                .filter_by(code=code)
            )
            role = result.scalar_one_or_none()
            if role is None:
                role = Role(code=code, name=name)
                db.add(role)
            # Pour un Role neuf, la collection est vide mais pas "lazy" :
            # l'affectation est donc sûre. Pour un Role existant, selectinload
            # a déjà chargé la relation.
            role.permissions = [permissions[p] for p in ROLE_PERMISSIONS[code]]

        await db.commit()
    print("Rôles et permissions initialisés.")


if __name__ == "__main__":
    asyncio.run(main())
