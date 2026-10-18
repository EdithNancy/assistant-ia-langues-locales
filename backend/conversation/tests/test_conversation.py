import base64
import os
import tempfile
import uuid

os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{tempfile.mkdtemp()}/test.db"

import pytest
from fastapi.testclient import TestClient

from app import billing
from app.ml import DialogueReply
from app.main import app

ALICE = {"X-User-Id": "alice", "X-User-Role": "user"}
BOB = {"X-User-Id": "bob", "X-User-Role": "user"}


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_requires_identity(client):
    assert client.get("/").status_code == 401


def test_crud_and_isolation(client):
    owner = {"X-User-Id": f"crud-{uuid.uuid4().hex}", "X-User-Role": "user"}
    other = {"X-User-Id": f"other-{uuid.uuid4().hex}", "X-User-Role": "user"}
    r = client.post("/", json={"title": "Sommeil"}, headers=owner)
    assert r.status_code == 201
    cid = r.json()["id"]
    assert [c["id"] for c in client.get("/", headers=owner).json()] == [cid]
    assert client.get("/", headers=other).json() == []
    assert client.get(f"/{cid}", headers=other).status_code == 404
    assert client.delete(f"/{cid}", headers=owner).status_code == 204
    assert client.get(f"/{cid}", headers=owner).status_code == 404


def test_text_chat(client, monkeypatch):
    charges = []

    async def has_tokens(*_args):
        return None

    async def charge(_client, _authorization, reply):
        charges.append(reply.total_tokens)

    async def reply(_history):
        return DialogueReply("Bonjour !", 2, 1, estimated_usage=True)

    monkeypatch.setattr(billing, "require_available_token", has_tokens)
    monkeypatch.setattr(billing, "charge_reply", charge)
    monkeypatch.setattr("app.api.ml.dialogue.reply", reply)
    cid = client.post("/", json={}, headers=ALICE).json()["id"]
    r = client.post(f"/{cid}/messages", json={"content": "Bonjour"}, headers=ALICE)
    assert r.status_code == 201 and r.json()["role"] == "assistant"
    assert r.json()["conversation_id"] == cid
    assert charges == [3]
    assert r.headers["X-Credit-Tokens-Charged"] == "3"
    assert r.headers["X-Model-Token-Usage-Estimated"] == "true"
    msgs = client.get(f"/{cid}", headers=ALICE).json()["messages"]
    assert [m["role"] for m in msgs] == ["user", "assistant"]
    assert {m["conversation_id"] for m in msgs} == {cid}

    response = client.get(f"/{cid}/messages", headers=ALICE)
    assert response.status_code == 200
    assert [message["role"] for message in response.json()] == ["user", "assistant"]
    assert {message["conversation_id"] for message in response.json()} == {cid}
    assert client.get(f"/{cid}/messages", headers=BOB).status_code == 404


def test_free_text_daily_limit(client, monkeypatch):
    monkeypatch.setattr("app.api.FREE_DAILY_TEXT_LIMIT", 1)
    replies = []

    async def has_tokens(*_args):
        return None

    async def charge(*_args):
        return None

    async def reply(_history):
        replies.append(True)
        return DialogueReply("Bonjour !", 2, 1, estimated_usage=True)

    monkeypatch.setattr(billing, "require_available_token", has_tokens)
    monkeypatch.setattr(billing, "charge_reply", charge)
    monkeypatch.setattr("app.api.ml.dialogue.reply", reply)
    headers = {
        "X-User-Id": f"free-text-{uuid.uuid4().hex}",
        "X-User-Role": "user",
    }
    cid = client.post("/", json={}, headers=headers).json()["id"]

    first = client.post(f"/{cid}/messages", json={"content": "Un"}, headers=headers)
    second = client.post(f"/{cid}/messages", json={"content": "Deux"}, headers=headers)

    assert first.status_code == 201
    assert second.status_code == 429
    assert second.json()["detail"] == "Limite quotidienne de 1 requête texte atteinte."
    assert int(second.headers["Retry-After"]) > 0
    assert len(replies) == 1

    pro_headers = {
        "X-User-Id": f"pro-text-{uuid.uuid4().hex}",
        "X-User-Role": "user",
        "X-User-Roles": "user,pro",
    }
    pro_cid = client.post("/", json={}, headers=pro_headers).json()["id"]
    assert client.post(
        f"/{pro_cid}/messages", json={"content": "Un"}, headers=pro_headers
    ).status_code == 201
    assert client.post(
        f"/{pro_cid}/messages", json={"content": "Deux"}, headers=pro_headers
    ).status_code == 201


def test_free_daily_quota_configuration():
    from app.usage_limits import FREE_DAILY_TEXT_LIMIT, FREE_DAILY_VOICE_LIMIT

    assert FREE_DAILY_TEXT_LIMIT == 500
    assert FREE_DAILY_VOICE_LIMIT == 50


def test_audio_upload_accepts_multipart_and_returns_audio_reply(client, monkeypatch):
    monkeypatch.setattr("app.api.FREE_DAILY_VOICE_LIMIT", 1)
    received_audio = []

    async def has_tokens(*_args):
        return None

    async def charge(*_args):
        return None

    async def transcribe(audio):
        received_audio.append(audio)
        return "Bonjour"

    async def reply(_history):
        return DialogueReply("Bonjour !", 2, 1, estimated_usage=True)

    async def synthesize(_text):
        yield b"audio-reponse"

    monkeypatch.setattr(billing, "require_available_token", has_tokens)
    monkeypatch.setattr(billing, "charge_reply", charge)
    monkeypatch.setattr("app.api.ml.stt.transcribe", transcribe)
    monkeypatch.setattr("app.api.ml.dialogue.reply", reply)
    monkeypatch.setattr("app.api.ml.tts.synthesize", synthesize)
    headers = {
        "X-User-Id": f"multipart-voice-{uuid.uuid4().hex}",
        "X-User-Role": "user",
    }
    cid = client.post("/", json={}, headers=headers).json()["id"]

    response = client.post(
        f"/{cid}/messages/audio",
        headers=headers,
        files={"audio": ("question.wav", b"audio-question", "audio/wav")},
    )

    assert response.status_code == 201
    assert received_audio == [b"audio-question"]
    assert response.json() == {
        "conversation_id": cid,
        "transcript": "Bonjour",
        "reply": "Bonjour !",
        "audio_output_base64": base64.b64encode(b"audio-reponse").decode("ascii"),
        "audio_output_media_type": "application/octet-stream",
        "credit_tokens_charged": 3,
        "model_token_usage_estimated": True,
    }
    limited = client.post(
        f"/{cid}/messages/audio",
        headers=headers,
        files={"audio": ("question.wav", b"audio-question", "audio/wav")},
    )
    assert limited.status_code == 429
    assert len(received_audio) == 1


def test_audio_websocket_turn(client, monkeypatch):
    async def has_tokens(*_args):
        return None

    async def charge(*_args):
        return None

    monkeypatch.setattr(billing, "require_available_token", has_tokens)
    monkeypatch.setattr(billing, "charge_reply", charge)
    cid = client.post("/", json={}, headers=ALICE).json()["id"]
    with client.websocket_connect(
        f"/ws?conversation_id={cid}", headers=ALICE
    ) as ws:
        ready = ws.receive_json()
        assert ready["type"] == "ready"
        assert ready["conversation_id"] == cid
        ws.send_bytes(b"\x00" * 10)
        ws.send_bytes(b"\x01" * 10)
        ws.send_json({"type": "end_of_speech"})
        transcript = ws.receive_json()
        assert transcript == {
            "type": "transcript",
            "conversation_id": cid,
            "text": "[audio de 20 octets]",
        }
        reply = ws.receive_json()
        assert reply["type"] == "reply"
        assert reply["conversation_id"] == cid
        assert reply["credit_tokens_charged"] > 0
        assert reply["model_token_usage_estimated"] is True
        audio = b""
        while True:
            m = ws.receive()
            if m.get("bytes") is not None:
                audio += m["bytes"]
            else:
                assert '"done"' in m["text"]
                break
        assert b"[audio de 20 octets]" in audio
    msgs = client.get(f"/{cid}", headers=ALICE).json()["messages"]
    assert len(msgs) == 2                                   # tour sauvegardé
    assert {m["conversation_id"] for m in msgs} == {cid}
    listed_messages = client.get(f"/{cid}/messages", headers=ALICE).json()
    assert len(listed_messages) == 2
    assert {message["conversation_id"] for message in listed_messages} == {cid}


def test_free_voice_daily_limit(client, monkeypatch):
    monkeypatch.setattr("app.ws.FREE_DAILY_VOICE_LIMIT", 1)

    async def has_tokens(*_args):
        return None

    async def charge(*_args):
        return None

    monkeypatch.setattr(billing, "require_available_token", has_tokens)
    monkeypatch.setattr(billing, "charge_reply", charge)
    headers = {
        "X-User-Id": f"free-voice-{uuid.uuid4().hex}",
        "X-User-Role": "user",
    }
    cid = client.post("/", json={}, headers=headers).json()["id"]

    with client.websocket_connect(f"/ws?conversation_id={cid}", headers=headers) as ws:
        assert ws.receive_json()["type"] == "ready"

        ws.send_bytes(b"\x00" * 10)
        ws.send_json({"type": "end_of_speech"})
        assert ws.receive_json()["type"] == "transcript"
        assert ws.receive_json()["type"] == "reply"
        while True:
            message = ws.receive()
            if message.get("bytes") is None:
                assert '"done"' in message["text"]
                break

        ws.send_bytes(b"\x01" * 10)
        ws.send_json({"type": "end_of_speech"})
        error = ws.receive_json()

    assert error["type"] == "error"
    assert error["status"] == 429
    assert error["detail"] == "Limite quotidienne de 1 tour vocal atteinte."
    assert error["retry_after"] > 0


def test_websocket_rules(client):
    with pytest.raises(Exception):                          # sans identité
        with client.websocket_connect("/ws"):
            pass
    with pytest.raises(Exception):                          # sans conversation active
        with client.websocket_connect("/ws", headers=ALICE):
            pass
    with pytest.raises(Exception):                          # conversation d'un autre
        cid = client.post("/", json={}, headers=ALICE).json()["id"]
        with client.websocket_connect(f"/ws?conversation_id={cid}", headers=BOB):
            pass
