import os, tempfile
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{tempfile.mkdtemp()}/test.db"

import pytest
from fastapi.testclient import TestClient

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
    r = client.post("/", json={"title": "Sommeil"}, headers=ALICE)
    assert r.status_code == 201
    cid = r.json()["id"]
    assert [c["id"] for c in client.get("/", headers=ALICE).json()] == [cid]
    assert client.get("/", headers=BOB).json() == []
    assert client.get(f"/{cid}", headers=BOB).status_code == 404       # pas à Bob
    assert client.delete(f"/{cid}", headers=ALICE).status_code == 204
    assert client.get(f"/{cid}", headers=ALICE).status_code == 404


def test_text_chat(client):
    cid = client.post("/", json={}, headers=ALICE).json()["id"]
    r = client.post(f"/{cid}/messages", json={"content": "Bonjour"}, headers=ALICE)
    assert r.status_code == 201 and r.json()["role"] == "assistant"
    msgs = client.get(f"/{cid}", headers=ALICE).json()["messages"]
    assert [m["role"] for m in msgs] == ["user", "assistant"]


def test_audio_websocket_turn(client):
    with client.websocket_connect("/ws", headers=ALICE) as ws:
        ready = ws.receive_json()
        assert ready["type"] == "ready"
        ws.send_bytes(b"\x00" * 10)
        ws.send_bytes(b"\x01" * 10)
        ws.send_json({"type": "end_of_speech"})
        assert ws.receive_json() == {"type": "transcript", "text": "[audio de 20 octets]"}
        assert ws.receive_json()["type"] == "reply"
        audio = b""
        while True:
            m = ws.receive()
            if m.get("bytes") is not None:
                audio += m["bytes"]
            else:
                assert '"done"' in m["text"]
                break
        assert b"[audio de 20 octets]" in audio
        cid = ready["conversation_id"]
    msgs = client.get(f"/{cid}", headers=ALICE).json()["messages"]
    assert len(msgs) == 2                                   # tour sauvegardé


def test_websocket_rules(client):
    with pytest.raises(Exception):                          # sans identité
        with client.websocket_connect("/ws"):
            pass
    with pytest.raises(Exception):                          # conversation d'un autre
        cid = client.post("/", json={}, headers=ALICE).json()["id"]
        with client.websocket_connect(f"/ws?conversation_id={cid}", headers=BOB):
            pass
