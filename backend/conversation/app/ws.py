"""WebSocket audio temps réel.

Protocole (push-to-talk, simple pour commencer ; VAD plus tard) :
  client -> serveur : frames binaires (audio), puis {"type": "end_of_speech"}
  serveur -> client : {"type":"ready","conversation_id"} à la connexion, puis pour chaque tour :
                      {"type":"transcript","text"} · {"type":"reply","text"} ·
                      frames binaires (audio de la réponse) · {"type":"done"}
"""
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from . import ml, service
from .db import SessionLocal

router = APIRouter()
MAX_AUDIO_BYTES = 10_000_000


async def run_turn(ws: WebSocket, session, cid: str, audio: bytes) -> None:
    text = await ml.stt.transcribe(audio)
    await ws.send_json({"type": "transcript", "text": text})
    await service.add_message(session, cid, "user", text)

    answer = await ml.dialogue.reply(await service.history(session, cid))
    await service.add_message(session, cid, "assistant", answer)
    await ws.send_json({"type": "reply", "text": answer})

    async for chunk in ml.tts.synthesize(answer):
        await ws.send_bytes(chunk)
    await ws.send_json({"type": "done"})


@router.websocket("/ws")
async def audio_socket(ws: WebSocket):
    user_id = ws.headers.get("x-user-id")
    if not user_id:
        await ws.close(code=4401)
        return
    async with SessionLocal() as session:
        cid = ws.query_params.get("conversation_id")
        if cid:
            conv = await service.get_owned(session, cid, user_id)
            if not conv:
                await ws.close(code=4404)
                return
        else:
            conv = await service.create_conversation(session, user_id)
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
                    audio = bytes(buffer)
                    buffer.clear()
                    await run_turn(ws, session, conv.id, audio)
                elif data.get("type") == "reset":
                    buffer.clear()
        except WebSocketDisconnect:
            pass
