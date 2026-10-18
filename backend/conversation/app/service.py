from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from .models import Conversation, Message


async def create_conversation(session: AsyncSession, user_id: str, title: str = "Nouvelle conversation") -> Conversation:
    conv = Conversation(user_id=user_id, title=title)
    session.add(conv)
    await session.commit()
    return conv


async def get_owned(session: AsyncSession, cid: str, user_id: str, with_messages: bool = False) -> Conversation | None:
    """Une conversation n'est visible que par son propriétaire (sinon None -> 404)."""
    q = select(Conversation).where(Conversation.id == cid, Conversation.user_id == user_id)
    if with_messages:
        q = q.options(selectinload(Conversation.messages))
    return (await session.execute(q)).scalar_one_or_none()


async def add_message(session: AsyncSession, cid: str, role: str, content: str) -> Message:
    msg = Message(conversation_id=cid, role=role, content=content)
    session.add(msg)
    await session.commit()
    return msg


async def history(session: AsyncSession, cid: str) -> list[dict]:
    rows = (await session.execute(
        select(Message).where(Message.conversation_id == cid).order_by(Message.id))).scalars()
    return [{"role": m.role, "content": m.content} for m in rows]


async def list_messages(session: AsyncSession, cid: str) -> list[Message]:
    rows = await session.scalars(
        select(Message)
        .where(Message.conversation_id == cid)
        .order_by(Message.id)
    )
    return list(rows)
