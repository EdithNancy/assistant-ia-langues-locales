"""WebSocket audio temps réel.

Protocole (push-to-talk, simple pour commencer ; VAD plus tard) :
  client -> serveur : frames binaires (audio), puis {"type": "end_of_speech"}
  serveur -> client : {"type":"ready","conversation_id"} à la connexion, puis pour chaque tour :
                      {"type":"transcript","conversation_id","text"} ·
                      {"type":"reply","conversation_id","text"} ·
                      frames binaires (audio de la réponse) · {"type":"done"}

Une conversation doit être créée avant la connexion et son identifiant passé dans
le paramètre conversation_id.
"""
import json

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect

from . import billing, ml, service
from .db import SessionLocal
from .processing import reply_to_transcript
from .usage_limits import (
    FREE_DAILY_VOICE_LIMIT,
    is_free_user,
    reserve_daily_request,
)

router = APIRouter()
MAX_AUDIO_BYTES = 10_000_000


async def run_turn(ws: WebSocket, session, cid: str, audio: bytes) -> None:
    text = await ml.stt.transcribe(audio)
    await ws.send_json({
        "type": "transcript",
        "conversation_id": cid,
        "text": text,
    })

    reply = await reply_to_transcript(
        session,
        cid,
        text,
        ws.app.state.identity_http,
        ws.headers.get("authorization"),
    )
    await ws.send_json({
        "type": "reply",
        "conversation_id": cid,
        "text": reply.content,
        "credit_tokens_charged": reply.total_tokens,
        "model_token_usage_estimated": reply.estimated_usage,
    })

    async for chunk in ml.tts.synthesize(reply.content):
        await ws.send_bytes(chunk)
    await ws.send_json({"type": "done"})


@router.websocket("/ws")
async def audio_socket(ws: WebSocket):
    user_id = ws.headers.get("x-user-id")
    if not user_id:
        await ws.close(code=4401)
        return
    free_user = is_free_user(
        ws.headers.get("x-user-role"),
        ws.headers.get("x-user-roles"),
    )
    async with SessionLocal() as session:
        cid = ws.query_params.get("conversation_id")
        if not cid:
            await ws.close(code=4400)
            return
        conv = await service.get_owned(session, cid, user_id)
        if not conv:
            await ws.close(code=4404)
            return
        await ws.accept()
        await ws.send_json({"type": "ready", "conversation_id": conv.id})

        buffer = bytearray()
        try:
            while True:
                msg = await ws.receive()
                if msg["type"] == "websocket.disconnect":
                    break
                if msg.get("bytes") is not None:
                    buffer.extend(msg["bytes"])
                    if len(buffer) > MAX_AUDIO_BYTES:
                        buffer.clear()
                        await ws.send_json(
                            {"type": "error", "detail": "Audio trop volumineux"}
                        )
                    continue
                try:
                    data = json.loads(msg.get("text") or "")
                except json.JSONDecodeError:
                    await ws.send_json({"type": "error", "detail": "JSON invalide"})
                    continue
                if data.get("type") == "end_of_speech":
                    if not buffer:
                        await ws.send_json({"type": "error", "detail": "Aucun audio reçu"})
                        continue
                    try:
                        await billing.require_available_token(
                            ws.app.state.identity_http,
                            ws.headers.get("authorization"),
                        )
                        if free_user:
                            await reserve_daily_request(
                                session,
                                user_id,
                                "voice",
                                FREE_DAILY_VOICE_LIMIT,
                            )
                    except HTTPException as exc:
                        error = {
                            "type": "error",
                            "status": exc.status_code,
                            "detail": exc.detail,
                        }
                        if exc.headers and "Retry-After" in exc.headers:
                            error["retry_after"] = int(exc.headers["Retry-After"])
                        await ws.send_json(error)
                        buffer.clear()
                        continue
                    audio = bytes(buffer)
                    buffer.clear()
                    try:
                        await run_turn(ws, session, conv.id, audio)
                    except HTTPException as exc:
                        await ws.send_json({
                            "type": "error",
                            "status": exc.status_code,
                            "detail": exc.detail,
                        })
                elif data.get("type") == "reset":
                    buffer.clear()
        except WebSocketDisconnect:
            pass
