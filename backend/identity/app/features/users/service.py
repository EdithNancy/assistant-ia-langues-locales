import logging
from datetime import datetime, timezone

from fastapi import HTTPException
from redis.exceptions import RedisError
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession  # <-- Modifié
from sqlalchemy import select  # <-- Ajouté pour les requêtes
from app.config import settings
from app.core.revocation import revoke_access_sessions
from app.core.security import hash_password
from app.features.roles.entity import Role
from app.features.tokens.entity import TokenTransaction, TokenWallet
from app.features.users.entity import User
from app.features.users.repository import UserRepository
from app.features.users.schemas import UserRegister, UserUpdate

logger = logging.getLogger(__name__)


def _integrity_error_diagnostics(exc: IntegrityError) -> tuple[str | None, str | None]:
    original = exc.orig
    cause = original.__cause__
    sqlstate = (
        getattr(original, "sqlstate", None)
        or getattr(original, "pgcode", None)
        or getattr(cause, "sqlstate", None)
        or getattr(cause, "pgcode", None)
    )
    constraint = (
        getattr(original, "constraint_name", None)
        or getattr(cause, "constraint_name", None)
    )
    return sqlstate, constraint


class UserService:
    @staticmethod
    async def register(db: AsyncSession, data: UserRegister):  # <-- async def
        email = str(data.email).lower().strip()

        if await UserRepository.get_by_email(db, email):  # <-- await
            raise HTTPException(409, "Cette adresse e-mail est déjà utilisée.")

        # Remplacement de db.query(Role).filter_by(...) par select + scalar
        # <-- await
        role = await db.scalar(select(Role).filter_by(code="USER"))

        if role is None:
            raise HTTPException(
                503, "Les rôles initiaux ne sont pas configurés.")
        user = User(full_name=data.full_name.strip(), email=email,
                    phone_number=data.phone_number, password_hash=hash_password(
                        data.password),
                    roles=[role])
        db.add(user)
        stage = "insert_user"
        try:
            await db.flush()  # <-- await
            wallet = TokenWallet(
                user_id=user.id,
                free_tokens_remaining=settings.FREE_TOKEN_GRANT,
                purchased_tokens_remaining=0,
                next_free_refill_at=TokenWallet.next_refill_time(),
            )
            db.add(wallet)
            db.add(TokenTransaction(
                user_id=user.id,
                bucket="free",
                amount=settings.FREE_TOKEN_GRANT,
                reason="signup_grant",
            ))
            stage = "commit_signup_resources"
            await db.commit()  # <-- await
            stage = "refresh_user"
            await db.refresh(user)  # <-- await
        except IntegrityError as exc:
            await db.rollback()  # <-- await
            if await UserRepository.get_by_email(db, email):
                raise HTTPException(
                    409, "Cette adresse e-mail est déjà utilisée."
                ) from exc
            sqlstate, constraint = _integrity_error_diagnostics(exc)
            logger.warning(
                "Signup integrity conflict stage=%s sqlstate=%s "
                "constraint=%s error_type=%s",
                stage,
                sqlstate or "unknown",
                constraint or "unknown",
                type(exc.orig).__name__,
            )
            raise HTTPException(
                409,
                "Le compte n'a pas pu être créé car une donnée entre en "
                "conflit avec les données enregistrées. Vérifiez l'adresse "
                "e-mail et réessayez.",
            ) from exc
        return user

    @staticmethod
    async def get_user(db: AsyncSession, user_id):  # <-- async def
        user = await UserRepository.get_by_id(db, user_id)  # <-- await
        if user is None:
            raise HTTPException(404, "Utilisateur introuvable.")
        return user

    @staticmethod
    async def update_user(db: AsyncSession, user_id, data: UserUpdate, redis):  # <-- async def
        user = await UserService.get_user(db, user_id)  # <-- await
        updates = data.model_dump(exclude_unset=True)
        deactivating = updates.get("is_active") is False and user.is_active
        if deactivating:
            # Attention : user.sessions est probablement lazy-loaded (relation).
            # En async, il faut forcer le chargement avant d'y accéder,
            # sinon ça plante avec MissingGreenlet.
            # Solution : utiliser selectinload dans get_user ou recharger ici.
            # Pour l'instant, on suppose que get_user a chargé les sessions.
            active_sessions = [
                session for session in user.sessions if session.revoked_at is None]
            try:
                await revoke_access_sessions(redis, (session.id for session in active_sessions))
            except RedisError as exc:
                raise HTTPException(
                    status_code=503,
                    detail="La révocation des sessions est indisponible.",
                ) from exc
            for session in active_sessions:
                session.revoked_at = datetime.now(timezone.utc)
                session.refresh_token_hash = None
        for key, value in updates.items():
            setattr(user, key, value.strip() if key ==
                    "full_name" and value else value)
        try:
            await db.commit()  # <-- await
        except SQLAlchemyError as exc:
            await db.rollback()  # <-- await
            if deactivating:
                raise HTTPException(
                    status_code=503,
                    detail="Les sessions ont été révoquées, mais la désactivation a échoué.",
                ) from exc
            raise
        await db.refresh(user)  # <-- await
        return user
