from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .pagination import apply_sort
from .models import Conversation, Message


async def create_conversation(session: AsyncSession, user_id: str, title: str = "Nouvelle conversation") -> Conversation:
    conv = Conversation(user_id=user_id, title=title)
    session.add(conv)
    await session.commit()
    return conv


async def get_owned(
    session: AsyncSession, cid: str, user_id: str
) -> Conversation | None:
    """Une conversation n'est visible que par son propriétaire (sinon None -> 404)."""
    q = select(Conversation).where(
        Conversation.id == cid, Conversation.user_id == user_id
    )
    return (await session.execute(q)).scalar_one_or_none()


async def add_message(
    session: AsyncSession,
    cid: str,
    role: str,
    content: str,
    **details,
) -> Message:
    msg = Message(conversation_id=cid, role=role, content=content, **details)
    session.add(msg)
    await session.commit()
    return msg


async def history(session: AsyncSession, cid: str) -> list[dict]:
    rows = (await session.execute(
        select(Message).where(Message.conversation_id == cid).order_by(Message.id))).scalars()
    return [{"role": m.role, "content": m.content} for m in rows]


async def list_messages_page(
    session: AsyncSession,
    cid: str,
    offset: int,
    limit: int,
    search: str | None = None,
    sort_by: str | None = None,
    sort_order: str | None = None,
) -> tuple[list[Message], int]:
    statement = select(Message).where(Message.conversation_id == cid)
    count_statement = (
        select(func.count())
        .select_from(Message)
        .where(Message.conversation_id == cid)
    )
    if search:
        condition = Message.content.ilike(f"%{search}%")
        statement = statement.where(condition)
        count_statement = count_statement.where(condition)
    total = await session.scalar(count_statement)
    statement = apply_sort(
        statement,
        sort_by=sort_by,
        sort_order=sort_order,
        columns={"created_at": Message.created_at, "role": Message.role},
        default="created_at",
        unique_column=Message.id,
        default_order="asc",
    )
    rows = await session.scalars(
        statement.offset(offset).limit(limit)
    )
    return list(rows), total or 0


async def list_conversations_page(
    session: AsyncSession,
    user_id: str,
    offset: int,
    limit: int,
    search: str | None = None,
    sort_by: str | None = None,
    sort_order: str | None = None,
) -> tuple[list[Conversation], int]:
    statement = select(Conversation).where(Conversation.user_id == user_id)
    count_statement = (
        select(func.count())
        .select_from(Conversation)
        .where(Conversation.user_id == user_id)
    )
    if search:
        condition = Conversation.title.ilike(f"%{search}%")
        statement = statement.where(condition)
        count_statement = count_statement.where(condition)
    total = await session.scalar(count_statement)
    statement = apply_sort(
        statement,
        sort_by=sort_by,
        sort_order=sort_order,
        columns={
            "created_at": Conversation.created_at,
            "title": Conversation.title,
        },
        default="created_at",
        unique_column=Conversation.id,
    )
    rows = await session.scalars(
        statement.offset(offset).limit(limit)
    )
    return list(rows), total or 0
