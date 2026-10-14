from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from . import ml, service
from .db import get_session
from .deps import CurrentUser, current_user
from .models import Conversation
from .schemas import ConversationCreate, ConversationDetail, ConversationOut, MessageIn, MessageOut

router = APIRouter()


@router.post("/", response_model=ConversationOut, status_code=201)
async def create(body: ConversationCreate, user: CurrentUser = Depends(current_user),
                 session: AsyncSession = Depends(get_session)):
    return await service.create_conversation(session, user.id, body.title)


@router.get("/", response_model=list[ConversationOut])
async def list_mine(user: CurrentUser = Depends(current_user), session: AsyncSession = Depends(get_session)):
    q = select(Conversation).where(Conversation.user_id == user.id).order_by(Conversation.created_at.desc())
    return (await session.execute(q)).scalars().all()


@router.get("/{cid}", response_model=ConversationDetail)
async def detail(cid: str, user: CurrentUser = Depends(current_user), session: AsyncSession = Depends(get_session)):
    conv = await service.get_owned(session, cid, user.id, with_messages=True)
    if not conv:
        raise HTTPException(404, "Conversation introuvable")
    return conv


@router.delete("/{cid}", status_code=204)
async def delete(cid: str, user: CurrentUser = Depends(current_user), session: AsyncSession = Depends(get_session)):
    conv = await service.get_owned(session, cid, user.id)
    if not conv:
        raise HTTPException(404, "Conversation introuvable")
    await session.delete(conv)
    await session.commit()
    return Response(status_code=204)


@router.post("/{cid}/messages", response_model=MessageOut, status_code=201)
async def send_text(cid: str, body: MessageIn, user: CurrentUser = Depends(current_user),
                    session: AsyncSession = Depends(get_session)):
    """Chat texte : enregistre le message, demande une réponse au Dialogue, renvoie la réponse."""
    if not await service.get_owned(session, cid, user.id):
        raise HTTPException(404, "Conversation introuvable")
    await service.add_message(session, cid, "user", body.content)
    answer = await ml.dialogue.reply(await service.history(session, cid))
    return await service.add_message(session, cid, "assistant", answer)
