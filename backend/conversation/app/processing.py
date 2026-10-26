import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from . import billing, ml, service
from .ml import DialogueReply
from .models import Message


async def reply_to_transcript(
    session: AsyncSession,
    conversation_id: str,
    transcript: str,
    identity_http: httpx.AsyncClient,
    authorization: str | None,
    language: str | None = None,
) -> tuple[Message, Message, DialogueReply]:
    # Normalize only when the client identifies the spoken language. The
    # original transcript remains available to the caller for display/debugging.
    user_message = await service.add_message(
        session, conversation_id, "user", transcript,
        original_content=transcript, transcript=transcript,
        modality="voice", status="processing",
    )
    dialogue_text = transcript
    if language:
        dialogue_text = await ml.orthography.normalize(transcript, language)
    user_message.content = dialogue_text
    history = await service.history(session, conversation_id)
    reply = await ml.dialogue.reply(history)
    await billing.charge_reply(identity_http, authorization, reply)
    user_message.reformulated_content = reply.reformulated_content
    user_message.understood_as = reply.understood_as
    user_message.status = "completed"
    user_message.input_tokens = reply.input_tokens
    user_message.output_tokens = reply.output_tokens
    user_message.estimated_usage = reply.estimated_usage
    await session.commit()
    assistant_message = await service.add_message(
        session, conversation_id, "assistant", reply.content,
        modality="voice", status="completed",
        input_tokens=reply.input_tokens, output_tokens=reply.output_tokens,
        estimated_usage=reply.estimated_usage,
    )
    return user_message, assistant_message, reply
