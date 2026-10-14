import uuid
from datetime import datetime, timezone
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.config import settings
from app.core.security import create_access_token, hash_refresh_token, new_refresh_token, refresh_expiry, verify_password
from app.features.sessions.entity import UserSession
from app.features.users.repository import UserRepository

class AuthService:
    @staticmethod
    def login(db: Session, email: str, password: str, user_agent=None, ip_address=None):
        user = UserRepository.get_by_email(db, email)
        if (user is None or user.password_hash is None
                or not verify_password(password, user.password_hash)):
            raise HTTPException(401, "E-mail ou mot de passe incorrect.")
        if not user.is_active:
            raise HTTPException(403, "Ce compte est désactivé.")
        return AuthService.create_session(db, user, user_agent, ip_address)

    @staticmethod
    def create_session(db: Session, user, user_agent=None, ip_address=None):
        refresh = new_refresh_token()
        session = UserSession(user_id=user.id, refresh_token_hash=hash_refresh_token(refresh),
                              expires_at=refresh_expiry(), user_agent=(user_agent or "")[:500] or None,
                              ip_address=ip_address)
        db.add(session)
        db.commit()
        db.refresh(session)
        return {"access_token": create_access_token(
                    str(user.id), str(session.id), [role.code for role in user.roles]),
                "refresh_token": refresh, "token_type": "bearer",
                "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60}

    @staticmethod
    def refresh(db: Session, refresh_token: str):
        session = db.scalar(
            select(UserSession)
            .where(UserSession.refresh_token_hash == hash_refresh_token(refresh_token))
            .with_for_update()
        )
        if session is None or session.revoked_at is not None:
            raise HTTPException(401, "Refresh token invalide ou expiré.")
        now = datetime.now(timezone.utc)
        expires_at = session.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at <= now:
            raise HTTPException(401, "Refresh token invalide ou expiré.")
        user = UserRepository.get_by_id(db, session.user_id)
        if user is None or not user.is_active:
            raise HTTPException(401, "Compte indisponible.")
        new_refresh = new_refresh_token()
        session.refresh_token_hash = hash_refresh_token(new_refresh)
        session.last_used_at = now
        db.commit()
        return {"access_token": create_access_token(
                    str(user.id), str(session.id), [role.code for role in user.roles]),
                "refresh_token": new_refresh, "token_type": "bearer",
                "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60}

    @staticmethod
    def logout(db: Session, session_id, user_id):
        session = db.get(UserSession, session_id)
        if session and session.user_id == user_id and session.revoked_at is None:
            session.revoked_at = datetime.now(timezone.utc)
            session.refresh_token_hash = None
            return session.id
        return None

    @staticmethod
    def logout_all(db: Session, user_id):
        now = datetime.now(timezone.utc)
        sessions = db.query(UserSession).filter_by(user_id=user_id, revoked_at=None).all()
        for session in sessions:
            session.revoked_at = now
            session.refresh_token_hash = None
        return [session.id for session in sessions]
