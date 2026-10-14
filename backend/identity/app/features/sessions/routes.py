import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.revocation import revoke_access_sessions
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
async def revoke_session(
    session_id: uuid.UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = SessionService.revoke_own(db, session_id, user.id)
    await revoke_access_sessions(request.app.state.redis, [session.id])
    db.commit()
    db.refresh(session)
    return session
