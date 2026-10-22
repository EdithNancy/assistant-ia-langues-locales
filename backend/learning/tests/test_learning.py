import os, tempfile
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{tempfile.mkdtemp()}/test.db"

import pytest
from fastapi.testclient import TestClient

from app.main import app

PRO = {"X-User-Id": "pro1", "X-User-Role": "pro"}
ADMIN = {"X-User-Id": "root", "X-User-Role": "admin"}
MAMAN = {"X-User-Id": "m1", "X-User-Role": "user"}


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_access_rules(client):
    assert client.get("/scenarios").status_code == 401
    assert client.get("/scenarios", headers=MAMAN).status_code == 403    # réservé aux pros


def test_catalog_seeded_and_filter(client):
    assert len(client.get("/scenarios", headers=PRO).json()["items"]) == 2
    only = client.get("/scenarios?level=debutant", headers=PRO).json()
    assert [s["level"] for s in only["items"]] == ["debutant"]


def test_only_admin_creates_scenario(client):
    body = {"title": "Cas difficile", "level": "avance", "objectives": ["x"]}
    assert client.post("/scenarios", json=body, headers=PRO).status_code == 403
    assert client.post("/scenarios", json=body, headers=ADMIN).status_code == 201


def test_attempt_flow_and_progress(client):
    sid = client.get("/scenarios?level=debutant", headers=PRO).json()["items"][0]["id"]
    a = client.post("/attempts", json={"scenario_id": sid}, headers=PRO).json()
    assert a["status"] == "in_progress"
    done = client.post(f"/attempts/{a['id']}/complete", json={"score": 80}, headers=PRO)
    assert done.status_code == 200 and done.json()["score"] == 80
    assert client.post(f"/attempts/{a['id']}/complete", json={"score": 90}, headers=PRO).status_code == 409
    assert client.post(f"/attempts/{a['id']}/complete", json={"score": 90}, headers=ADMIN).status_code == 404
    assert client.post("/attempts", json={"scenario_id": "nope"}, headers=PRO).status_code == 404
    assert client.post(f"/attempts/{a['id']}/complete", json={"score": 150}, headers=PRO).status_code in (409, 422)

    p = client.get("/progress", headers=PRO).json()
    assert p["attempts"] == 1 and p["completed"] == 1 and p["average_score"] == 80
    assert p["by_level"]["debutant"] == {"completed": 1, "average_score": 80}
