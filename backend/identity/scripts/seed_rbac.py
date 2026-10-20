from app.core.database import SessionLocal

# Charger tous les modèles SQLAlchemy avant les requêtes
from app.features.users.entity import User
from app.features.sessions.entity import UserSession
from app.features.roles.entity import Role
from app.features.permissions.entity import Permission
from app.features.auth.social import FederatedIdentity

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


def main():
    with SessionLocal() as db:
        permissions = {}
        for code, name in PERMISSIONS:
            obj = db.query(Permission).filter_by(code=code).first()
            if obj is None:
                obj = Permission(code=code, name=name)
                db.add(obj)
            permissions[code] = obj
        db.flush()
        for code, name in ROLE_NAMES.items():
            role = db.query(Role).filter_by(code=code).first()
            if role is None:
                role = Role(code=code, name=name)
                db.add(role)
            role.permissions = [permissions[p] for p in ROLE_PERMISSIONS[code]]
        db.commit()
    print("Rôles et permissions initialisés.")


if __name__ == "__main__":
    main()
