import base64

from fastapi import (
    APIRouter,
    Depends,
    File,
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


@router.post("/{cid}/messages", response_model=MessageOut, status_code=201)
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
    history = await service.history(session, cid)
    history.append({"role": "user", "content": body.content})
    reply = await ml.dialogue.reply(history)
    await billing.charge_reply(
        request.app.state.identity_http, request.headers.get(
            "authorization"), reply
    )
    await service.add_message(session, cid, "user", body.content)
    response.headers["X-Credit-Tokens-Charged"] = str(reply.total_tokens)
    response.headers["X-Model-Token-Usage-Estimated"] = str(
        reply.estimated_usage).lower()
    return await service.add_message(session, cid, "assistant", reply.content)


@router.post(
    "/{cid}/messages/audio",
    response_model=VoiceMessageOut,
    status_code=201,
)
async def send_audio(
    cid: str,
    request: Request,
    audio: UploadFile = File(...),
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
   # if user.is_free:
   #     await reserve_daily_request(
   #         session, user.id, "voice", FREE_DAILY_VOICE_LIMIT
   #    )

    transcript = await ml.stt.transcribe(data)
    reply = await reply_to_transcript(
        session,
        cid,
        transcript,
        request.app.state.identity_http,
        request.headers.get("authorization"),
    )
    audio_output = b"".join(
        [chunk async for chunk in ml.tts.synthesize(reply.content)]
    )
    return VoiceMessageOut(
        conversation_id=cid,
        transcript=transcript,
        reply=reply.content,
        audio_output_base64=base64.b64encode(audio_output).decode("ascii"),
        audio_output_media_type="application/octet-stream",
        credit_tokens_charged=reply.total_tokens,
        model_token_usage_estimated=reply.estimated_usage,
    )
