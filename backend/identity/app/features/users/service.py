from datetime import datetime, timezone

from fastapi import HTTPException
from redis.exceptions import RedisError
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session
from app.config import settings
from app.core.revocation import revoke_access_sessions
from app.core.security import hash_password
from app.features.roles.entity import Role
from app.features.tokens.entity import TokenTransaction, TokenWallet
from app.features.users.entity import User
from app.features.users.repository import UserRepository
from app.features.users.schemas import UserRegister, UserUpdate

class UserService:
    @staticmethod
    def register(db: Session, data: UserRegister):
        email = str(data.email).lower().strip()
        if UserRepository.get_by_email(db, email):
            raise HTTPException(409, "Cette adresse e-mail est déjà utilisée.")
        role = db.query(Role).filter_by(code="USER").first()
        if role is None:
            raise HTTPException(503, "Les rôles initiaux ne sont pas configurés.")
        user = User(full_name=data.full_name.strip(), email=email,
                    phone_number=data.phone_number, password_hash=hash_password(data.password),
                    roles=[role])
        db.add(user)
        try:
            db.flush()
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
            db.commit()
            db.refresh(user)
        except IntegrityError:
            db.rollback()
            raise HTTPException(409, "Impossible de créer ce compte.")
        return user

    @staticmethod
    def get_user(db: Session, user_id):
        user = UserRepository.get_by_id(db, user_id)
        if user is None:
            raise HTTPException(404, "Utilisateur introuvable.")
        return user

    @staticmethod
    async def update_user(db: Session, user_id, data: UserUpdate, redis):
        user = UserService.get_user(db, user_id)
        updates = data.model_dump(exclude_unset=True)
        deactivating = updates.get("is_active") is False and user.is_active
        if deactivating:
            active_sessions = [session for session in user.sessions if session.revoked_at is None]
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
            setattr(user, key, value.strip() if key == "full_name" and value else value)
        try:
            db.commit()
        except SQLAlchemyError as exc:
            db.rollback()
            if deactivating:
                raise HTTPException(
                    status_code=503,
                    detail="Les sessions ont été révoquées, mais la désactivation a échoué.",
                ) from exc
            raise
        db.refresh(user)
        return user
