from dataclasses import replace
from datetime import datetime, timedelta, timezone

import httpx
import jwt
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app


def test_identity_upstream_defaults_to_local_host(monkeypatch) -> None:
    monkeypatch.delenv("IDENTITY_URL", raising=False)

    assert settings.routes["auth"].upstream == "http://127.0.0.1:8001/api/v1/auth"


def test_health_readiness_metrics_and_request_id(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.main.settings",
        replace(settings, jwt_key="test-secret-key-with-at-least-32-characters", redis_url=None),
    )

    with TestClient(app) as client:
        response = client.get("/health", headers={"X-Request-ID": "external-id"})
        assert response.status_code == 200
        assert response.headers["X-Request-ID"] == "external-id"

        async def healthy(url: str, **_kwargs) -> httpx.Response:
            return httpx.Response(200, request=httpx.Request("GET", url))

        monkeypatch.setattr(
            client.app.state.http, "get", healthy
        )
        assert client.get("/ready").json() == {"status": "ready"}
        assert client.get("/metrics").status_code == 200


def test_request_id_is_replaced_when_unbounded(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.main.settings",
        replace(settings, jwt_key="test-secret-key-with-at-least-32-characters", redis_url=None),
    )

    with TestClient(app) as client:
        response = client.get("/health", headers={"X-Request-ID": "x" * 100})

    assert response.status_code == 200
    assert len(response.headers["X-Request-ID"]) == 32


def test_gateway_rejects_a_revoked_session(monkeypatch) -> None:
    key = "test-secret-key-with-at-least-32-characters"
    session_id = "45f151c3-4702-4eb0-8d71-80213b716a66"
    monkeypatch.setattr("app.main.settings", replace(settings, jwt_key=key, redis_url=None))
    monkeypatch.setattr("app.auth.settings", replace(settings, jwt_key=key))
    token = jwt.encode(
        {
            "sub": "user-123",
            "sid": session_id,
            "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
            "roles": ["user"],
        },
        key,
        algorithm=settings.jwt_algorithm,
    )

    class RevokedSessionLimiter:
        async def hit(self, _key: str) -> tuple[bool, int]:
            return True, 60

        async def is_revoked(self, received_session_id: str) -> bool:
            return received_session_id == session_id

        async def close(self) -> None:
            return None

    with TestClient(app) as client:
        client.app.state.limiter = RevokedSessionLimiter()
        response = client.get(
            "/api/conversations/",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 401
    assert response.json()["detail"] == "Session révoquée"


def test_gateway_readiness_fails_when_an_upstream_is_unhealthy(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.main.settings",
        replace(settings, jwt_key="test-secret-key-with-at-least-32-characters", redis_url=None),
    )

    with TestClient(app) as client:
        async def unhealthy(url: str, **_kwargs) -> httpx.Response:
            return httpx.Response(503, request=httpx.Request("GET", url))

        monkeypatch.setattr(
            client.app.state.http, "get", unhealthy
        )
        response = client.get("/ready")

    assert response.status_code == 503
    assert response.json() == {"status": "not_ready", "service": "identity"}
