from dataclasses import replace
from datetime import datetime, timedelta, timezone

import jwt
import pytest
from fastapi import HTTPException

from app.auth import User, decode_token
from app.config import Settings, _jwt_env, settings
from app.main import check_role
from app.proxy import _excluded_headers, proxy_websocket, user_headers
from app.ratelimit import RateLimiter


def test_decode_token_preserves_all_roles_case_insensitively(monkeypatch: pytest.MonkeyPatch) -> None:
    key = "test-secret-key-with-at-least-32-characters"
    monkeypatch.setattr("app.auth.settings", replace(settings, jwt_key=key))
    token = jwt.encode(
        {
            "sub": "user-123",
            "sid": "45f151c3-4702-4eb0-8d71-80213b716a66",
            "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
            "roles": ["USER", "PRO"],
        },
        key,
        algorithm=settings.jwt_algorithm,
    )

    user = decode_token(token)

    assert user.roles == frozenset({"user", "pro"})


def test_check_role_allows_any_matching_role() -> None:
    user = User(
        id="user-123",
        roles=frozenset({"user", "pro"}),
        session_id="45f151c3-4702-4eb0-8d71-80213b716a66",
    )
    check_role(user, frozenset({"admin", "pro"}))
    assert user_headers(user, "request-123")["X-User-Roles"] == "pro,user"


def test_check_role_rejects_users_without_allowed_role() -> None:
    with pytest.raises(HTTPException) as error:
        check_role(
            User(
                id="user-123",
                roles=frozenset({"user"}),
                session_id="45f151c3-4702-4eb0-8d71-80213b716a66",
            ),
            frozenset({"admin", "pro"}),
        )

    assert error.value.status_code == 403


def test_gateway_rejects_unsafe_runtime_configuration() -> None:
    with pytest.raises(ValueError, match="JWT_KEY"):
        Settings(jwt_key="change-me").validate()
    with pytest.raises(ValueError, match="CORS_ORIGINS"):
        Settings(jwt_key="x" * 32, cors_origins=["*"]).validate()


def test_jwt_settings_prefer_shared_identity_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("JWT_SECRET_KEY", raising=False)
    monkeypatch.setenv("JWT_KEY", "stale-gateway-secret")
    monkeypatch.setattr(
        "app.config._dotenv_env",
        lambda _path, name: {
            "JWT_SECRET_KEY": "identity-secret",
            "JWT_ALGORITHM": "HS384",
            "JWT_AUDIENCE": "assistant-api",
        }.get(name, ""),
    )

    assert _jwt_env("JWT_SECRET_KEY", legacy_name="JWT_KEY") == "identity-secret"
    assert _jwt_env("JWT_ALGORITHM", default="HS256") == "HS384"
    assert _jwt_env("JWT_AUDIENCE") == "assistant-api"


def test_empty_jwt_audience_environment_matches_identity(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.config._dotenv_env", lambda _path, _name: "file-audience")
    monkeypatch.setenv("JWT_AUDIENCE", "")

    assert _jwt_env("JWT_AUDIENCE") == ""


def test_jwt_environment_override_and_legacy_compose_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.config._dotenv_env", lambda _path, _name: "file-secret")
    monkeypatch.setenv("JWT_SECRET_KEY", "shared-process-secret")
    assert _jwt_env("JWT_SECRET_KEY", legacy_name="JWT_KEY") == "shared-process-secret"

    monkeypatch.delenv("JWT_SECRET_KEY")
    monkeypatch.setattr("app.config._dotenv_env", lambda _path, _name: None)
    monkeypatch.setenv("JWT_KEY", "compose-secret")
    assert _jwt_env("JWT_SECRET_KEY", legacy_name="JWT_KEY") == "compose-secret"


def test_shared_backend_file_precedes_identity_file_and_legacy_key(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("JWT_SECRET_KEY", raising=False)
    monkeypatch.setenv("JWT_KEY", "stale-gateway-secret")
    monkeypatch.setattr(
        "app.config._dotenv_env",
        lambda path, _name: "shared-backend-secret"
        if path.name == ".env" and path.parent.name == "backend"
        else "identity-secret",
    )

    assert _jwt_env("JWT_SECRET_KEY", legacy_name="JWT_KEY") == "shared-backend-secret"


def test_connection_header_tokens_are_removed_from_proxy_headers() -> None:
    excluded = _excluded_headers(
        {
            "Connection": "keep-alive, X-Internal-Secret",
            "X-Internal-Secret": "untrusted",
            "X-Token-Usage-Source": "conversation",
        }
    )

    assert "x-internal-secret" in excluded
    assert "x-token-usage-source" in excluded
    assert "keep-alive" in excluded


def test_websocket_proxy_forwards_the_verified_bearer_token(monkeypatch: pytest.MonkeyPatch) -> None:
    import asyncio

    captured: dict = {}

    class Upstream:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def send(self, _message):
            return None

        def __aiter__(self):
            return self

        async def __anext__(self):
            raise StopAsyncIteration

    class ClientWebSocket:
        async def accept(self):
            return None

        async def receive(self):
            return {"type": "websocket.disconnect"}

        async def close(self, **_kwargs):
            return None

    def connect(_url: str, **kwargs):
        captured.update(kwargs)
        return Upstream()

    monkeypatch.setattr("app.proxy.websockets.connect", connect)
    user = User(
        id="user-123",
        roles=frozenset({"user"}),
        session_id="45f151c3-4702-4eb0-8d71-80213b716a66",
    )

    asyncio.run(proxy_websocket(
        ClientWebSocket(),
        "ws://conversation:8002/ws",
        user,
        "request-id",
        "Bearer verified-access-token",
    ))

    assert captured["additional_headers"]["Authorization"] == "Bearer verified-access-token"
    assert captured["additional_headers"]["X-User-Id"] == "user-123"


def test_memory_rate_limiter_limits_and_resets() -> None:
    async def exercise() -> None:
        limiter = RateLimiter(None, limit=1, window=1)
        assert (await limiter.hit("user:one"))[0] is True
        assert (await limiter.hit("user:one"))[0] is False
        limiter._mem["user:one"] = (0, 1)
        assert (await limiter.hit("user:one"))[0] is True
        await limiter.close()

    import asyncio

    asyncio.run(exercise())
