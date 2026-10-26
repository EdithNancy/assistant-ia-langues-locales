import base64

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Request,
    Response,
    UploadFile,
)
from sqlalchemy.ext.asyncio import AsyncSession

from . import billing, ml, service
from .db import get_session
from .deps import CurrentUser, current_user
from .pagination import (
    ListRequest,
    PaginatedResponse,
    get_list_request,
    paginated_response,
    validate_list_query,
)
from .processing import reply_to_transcript
from .schemas import (
    ConversationCreate,
    ConversationDetail,
    ConversationOut,
    ChatTurnOut,
    MessageIn,
    MessageOut,
    VoiceMessageOut,
)
from .usage_limits import (
    FREE_DAILY_TEXT_LIMIT,
    FREE_DAILY_VOICE_LIMIT,
    reserve_daily_request,
)

router = APIRouter()
MAX_AUDIO_BYTES = 10_000_000


@router.post("/", response_model=ConversationOut, status_code=201)
async def create(body: ConversationCreate, user: CurrentUser = Depends(current_user),
                 session: AsyncSession = Depends(get_session)):
    return await service.create_conversation(session, user.id, body.title)


@router.get("/", response_model=PaginatedResponse[ConversationOut])
async def list_mine(
    http_request: Request,
    list_query: ListRequest = Depends(get_list_request),
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
):
    validate_list_query(http_request)
    items, total = await service.list_conversations_page(
        session,
        user.id,
        list_query.offset,
        list_query.limit,
        list_query.search,
        list_query.sort_by,
        list_query.sort_order,
    )
    return paginated_response(
        items, total, list_query.offset, list_query.limit
    )


@router.get("/{cid}", response_model=ConversationDetail)
async def detail(
    cid: str,
    http_request: Request,
    list_query: ListRequest = Depends(get_list_request),
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
):
    validate_list_query(http_request)
    conv = await service.get_owned(session, cid, user.id)
    if not conv:
        raise HTTPException(404, "Conversation introuvable")
    messages, total = await service.list_messages_page(
        session,
        cid,
        list_query.offset,
        list_query.limit,
        list_query.search,
        list_query.sort_by,
        list_query.sort_order,
    )
    return ConversationDetail(
        id=conv.id,
        title=conv.title,
        created_at=conv.created_at,
        messages=paginated_response(
            messages, total, list_query.offset, list_query.limit
        ),
    )


@router.get("/{cid}/messages", response_model=PaginatedResponse[MessageOut])
async def list_messages(
    cid: str,
    http_request: Request,
    list_query: ListRequest = Depends(get_list_request),
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
):
    validate_list_query(http_request)
    if not await service.get_owned(session, cid, user.id):
        raise HTTPException(404, "Conversation introuvable")
    messages, total = await service.list_messages_page(
        session,
        cid,
        list_query.offset,
        list_query.limit,
        list_query.search,
        list_query.sort_by,
        list_query.sort_order,
    )
    return paginated_response(
        messages, total, list_query.offset, list_query.limit
    )


@router.delete("/{cid}", status_code=204)
async def delete(cid: str, user: CurrentUser = Depends(current_user), session: AsyncSession = Depends(get_session)):
    conv = await service.get_owned(session, cid, user.id)
    if not conv:
        raise HTTPException(404, "Conversation introuvable")
    await session.delete(conv)
    await session.commit()
    return Response(status_code=204)


@router.post("/{cid}/messages", response_model=ChatTurnOut, status_code=201)
async def send_text(cid: str, body: MessageIn, request: Request, response: Response,
                    user: CurrentUser = Depends(current_user),
                    session: AsyncSession = Depends(get_session)):
    """Chat texte : enregistre le message, demande une réponse au Dialogue, renvoie la réponse."""
    if not await service.get_owned(session, cid, user.id):
        raise HTTPException(404, "Conversation introuvable")
    await billing.require_available_token(
        request.app.state.identity_http, request.headers.get("authorization")
    )
    if user.is_free:
        await reserve_daily_request(
            session, user.id, "text", FREE_DAILY_TEXT_LIMIT
        )
    # Persist the exact submitted text before model work so failed requests never
    # silently lose what the user typed.
    user_message = await service.add_message(
        session, cid, "user", body.content,
        original_content=body.content, modality="text", status="processing",
    )
    history = await service.history(session, cid)
    reply = await ml.dialogue.reply(history)
    await billing.charge_reply(
        request.app.state.identity_http, request.headers.get(
            "authorization"), reply
    )
    user_message.reformulated_content = reply.reformulated_content
    user_message.understood_as = reply.understood_as
    user_message.status = "completed"
    user_message.input_tokens = reply.input_tokens
    user_message.output_tokens = reply.output_tokens
    user_message.estimated_usage = reply.estimated_usage
    await session.commit()
    response.headers["X-Credit-Tokens-Charged"] = str(reply.total_tokens)
    response.headers["X-Model-Token-Usage-Estimated"] = str(
        reply.estimated_usage).lower()
    assistant_message = await service.add_message(
        session, cid, "assistant", reply.content,
        modality="text", status="completed",
        input_tokens=reply.input_tokens, output_tokens=reply.output_tokens,
        estimated_usage=reply.estimated_usage,
    )
    return ChatTurnOut(
        id=assistant_message.id,
        conversation_id=cid,
        role="assistant",
        content=assistant_message.content,
        created_at=assistant_message.created_at,
        user_message=user_message,
        usage={
            "input_tokens": reply.input_tokens,
            "output_tokens": reply.output_tokens,
            "total_tokens": reply.total_tokens,
            "estimated": reply.estimated_usage,
        },
    )


@router.post(
    "/{cid}/messages/audio",
    response_model=VoiceMessageOut,
    status_code=201,
)
async def send_audio(
    cid: str,
    request: Request,
    audio: UploadFile = File(...),
    language: str | None = Form(default=None),
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
):
    """Traite un fichier audio envoyé en multipart et renvoie la réponse vocale."""
    if not await service.get_owned(session, cid, user.id):
        raise HTTPException(404, "Conversation introuvable")

    data = await audio.read(MAX_AUDIO_BYTES + 1)
    await audio.close()
    if not data:
        raise HTTPException(400, "Le fichier audio est vide.")
    if len(data) > MAX_AUDIO_BYTES:
        raise HTTPException(413, "Audio trop volumineux.")

    await billing.require_available_token(
        request.app.state.identity_http, request.headers.get("authorization")
    )
    if user.is_free:
        await reserve_daily_request(
            session, user.id, "voice", FREE_DAILY_VOICE_LIMIT
        )

    transcript = (
        await ml.stt.transcribe(data, language)
        if language
        else await ml.stt.transcribe(data)
    )
    user_message, assistant_message, reply = await reply_to_transcript(
        session,
        cid,
        transcript,
        request.app.state.identity_http,
        request.headers.get("authorization"),
        language,
    )
    audio_output = b"".join(
        [
            chunk
            async for chunk in (
                ml.tts.synthesize(reply.content, language)
                if language
                else ml.tts.synthesize(reply.content)
            )
        ]
    )
    return VoiceMessageOut(
        conversation_id=cid,
        transcript=transcript,
        reply=reply.content,
        user_message_id=user_message.id,
        assistant_message_id=assistant_message.id,
        reformulated_message=reply.reformulated_content,
        understood_as=reply.understood_as,
        audio_output_base64=base64.b64encode(audio_output).decode("ascii"),
        audio_output_media_type="application/octet-stream",
        credit_tokens_charged=reply.total_tokens,
        model_token_usage_estimated=reply.estimated_usage,
    )
