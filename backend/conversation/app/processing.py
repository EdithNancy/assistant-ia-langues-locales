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
    language: str | None = None,
) -> DialogueReply:
    # Normalize only when the client identifies the spoken language. The
    # original transcript remains available to the caller for display/debugging.
    dialogue_text = transcript
    if language:
        dialogue_text = await ml.orthography.normalize(transcript, language)
    history = await service.history(session, conversation_id)
    history.append({"role": "user", "content": dialogue_text})
    reply = await ml.dialogue.reply(history)
    await billing.charge_reply(identity_http, authorization, reply)
    await service.add_message(session, conversation_id, "user", dialogue_text)
    await service.add_message(session, conversation_id, "assistant", reply.content)
    return reply
