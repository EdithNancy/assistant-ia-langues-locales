import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from . import billing, ml, service
from .ml import DialogueReply


async def reply_to_transcript(
    session: AsyncSession,
    conversation_id: str,
    transcript: str,
    identity_http: httpx.AsyncClient,
    authorization: str | None,
) -> DialogueReply:
    history = await service.history(session, conversation_id)
    history.append({"role": "user", "content": transcript})
    reply = await ml.dialogue.reply(history)
    await billing.charge_reply(identity_http, authorization, reply)
    await service.add_message(session, conversation_id, "user", transcript)
    await service.add_message(session, conversation_id, "assistant", reply.content)
    return reply
