import os
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.features.permissions.entity import Permission  # noqa: F401 - enregistre le modèle ORM
from app.features.roles.entity import Role
from app.features.users.entity import User
from app.features.sessions.entity import UserSession


def main():
    name = os.getenv("BOOTSTRAP_ADMIN_NAME")
    email = os.getenv("BOOTSTRAP_ADMIN_EMAIL")
    password = os.getenv("BOOTSTRAP_ADMIN_PASSWORD")
    if not all((name, email, password)):
        raise SystemExit(
            "Définir BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_EMAIL et BOOTSTRAP_ADMIN_PASSWORD.")
    if len(password) < 12:
        raise SystemExit(
            "Le mot de passe initial doit contenir au moins 12 caractères.")
    with SessionLocal() as db:
        if db.query(User).filter_by(email=email.lower().strip()).first():
            raise SystemExit("Cet e-mail existe déjà.")
        role = db.query(Role).filter_by(code="SUPER_ADMIN").first()
        if role is None:
            raise SystemExit("Lancer d'abord python -m scripts.seed_rbac")
        db.add(User(full_name=name.strip(), email=email.lower().strip(),
                    password_hash=hash_password(password), is_active=True,
                    is_verified=True, roles=[role]))
        db.commit()
    print("Super administrateur créé.")


if __name__ == "__main__":
    main()
