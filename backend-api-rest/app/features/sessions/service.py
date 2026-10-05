from datetime import datetime, timezone
from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.features.sessions.entity import UserSession

class SessionService:
    @staticmethod
    def list_own(db: Session, user_id):
        return db.query(UserSession).filter_by(user_id=user_id).order_by(UserSession.created_at.desc()).all()
    @staticmethod
    def revoke_own(db: Session, session_id, user_id):
        session = db.get(UserSession, session_id)
        if session is None or session.user_id != user_id:
            raise HTTPException(404, "Session introuvable.")
        if session.revoked_at is None:
            session.revoked_at = datetime.now(timezone.utc)
            session.refresh_token_hash = None
            db.commit()
            db.refresh(session)
        return session
