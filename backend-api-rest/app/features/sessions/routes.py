import uuid
from datetime import datetime
from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.features.sessions.service import SessionService
from app.features.users.entity import User

router = APIRouter(prefix="/sessions", tags=["Sessions"])

class SessionResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    user_agent: str | None
    ip_address: str | None
    expires_at: datetime
    last_used_at: datetime | None
    revoked_at: datetime | None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

@router.get("", response_model=list[SessionResponse])
def list_sessions(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return SessionService.list_own(db, user.id)

@router.delete("/{session_id}", response_model=SessionResponse)
def revoke_session(session_id: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return SessionService.revoke_own(db, session_id, user.id)
