from dataclasses import replace
from datetime import datetime, timedelta, timezone

import jwt
import pytest
from fastapi import HTTPException

from app.auth import User, decode_token
from app.config import Settings, settings
from app.main import check_role
from app.proxy import _excluded_headers, user_headers
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


def test_connection_header_tokens_are_removed_from_proxy_headers() -> None:
    excluded = _excluded_headers(
        {
            "Connection": "keep-alive, X-Internal-Secret",
            "X-Internal-Secret": "untrusted",
        }
    )

    assert "x-internal-secret" in excluded
    assert "keep-alive" in excluded


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
