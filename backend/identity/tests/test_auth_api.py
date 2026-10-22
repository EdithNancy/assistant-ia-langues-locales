import asyncio
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from limits.storage import MemoryStorage
from limits.strategies import FixedWindowRateLimiter

from app.config import settings
from app.core.database import Base, get_db
from app.core.rate_limit import limiter
from app.core.security import decode_token
from app.features.auth.routes import router as auth_router
from app.features.auth.schemas import LoginRequest
from app.features.permissions.entity import Permission
from app.features.roles.entity import Role
from app.features.sessions.entity import UserSession
from app.features.users.entity import User
from app.features.users.routes import router as users_router
from app.features.users.schemas import UserUpdate
from app.features.users.service import UserService


class FakeRedisPipeline:
    def __init__(self, redis: "FakeRedis") -> None:
        self.redis = redis
        self.pending: list[tuple[str, str, int]] = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return None

    def set(self, key: str, value: str, ex: int):
        self.pending.append((key, value, ex))

    async def execute(self):
        self.redis.revoked.update(
            {key: (value, ttl) for key, value, ttl in self.pending}
        )


class FakeRedis:
    def __init__(self) -> None:
        self.revoked: dict[str, tuple[str, int]] = {}

    def pipeline(self, transaction: bool = True) -> FakeRedisPipeline:
        return FakeRedisPipeline(self)


@pytest.fixture
def api_client(monkeypatch: pytest.MonkeyPatch):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    test_session = sessionmaker(bind=engine, expire_on_commit=False)
    with test_session() as db:
        db.add_all([
            Role(code="USER", name="Utilisateur"),
            Permission(code="test.permission", name="Permission de test"),
        ])
        db.commit()

    def override_get_db():
        with test_session() as db:
            yield db

    test_app = FastAPI()
    test_app.state.redis = FakeRedis()
    test_app.state.test_session = test_session
    test_app.include_router(auth_router, prefix=settings.API_V1_PREFIX)
    test_app.include_router(users_router, prefix=settings.API_V1_PREFIX)
    test_app.dependency_overrides[get_db] = override_get_db
    monkeypatch.setattr(limiter, "enabled", False)

    try:
        with TestClient(test_app) as client:
            yield client
    finally:
        test_app.dependency_overrides.clear()
        Base.metadata.drop_all(engine)
        engine.dispose()


def test_authentication_and_token_balance_work_over_http(api_client: TestClient) -> None:
    email = f"{uuid.uuid4()}@example.com"
    password = "MotDePasse-Secure-123"
    register_response = api_client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Test Utilisateur",
            "email": email,
            "phone_number": "+225 01 02 03 04 05",
            "password": password,
        },
    )

    assert register_response.status_code == 201
    profile = register_response.json()
    assert profile["email"] == email
    assert profile["phone_number"] == "+2250102030405"
    assert "password" not in profile

    login_response = api_client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert login_response.status_code == 200
    tokens = login_response.json()
    assert tokens["token_type"] == "bearer"
    assert tokens["access_token"]
    assert tokens["refresh_token"]
    assert decode_token(tokens["access_token"])["roles"] == ["user"]

    authorization = {"Authorization": f"Bearer {tokens['access_token']}"}
    me_response = api_client.get("/api/v1/users/me", headers=authorization)
    assert me_response.status_code == 200
    assert me_response.json()["id"] == profile["id"]

    balance_response = api_client.get("/api/v1/users/me/tokens", headers=authorization)
    assert balance_response.status_code == 200
    balance = balance_response.json()
    assert balance["has_tokens"] is True
    assert balance["total_tokens"] == settings.FREE_TOKEN_GRANT

    consume_url = "/api/v1/users/me/tokens/consume"
    denied_consume_response = api_client.post(
        consume_url,
        headers=authorization,
        json={"credit_tokens": 37},
    )
    assert denied_consume_response.status_code == 403

    consume_response = api_client.post(
        consume_url,
        headers={**authorization, "X-Token-Usage-Source": "conversation"},
        json={"credit_tokens": 37},
    )
    assert consume_response.status_code == 200
    assert consume_response.json()["free_tokens_remaining"] == settings.FREE_TOKEN_GRANT - 37

    refresh_response = api_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": tokens["refresh_token"]},
    )
    assert refresh_response.status_code == 200
    refreshed_tokens = refresh_response.json()
    assert refreshed_tokens["refresh_token"] != tokens["refresh_token"]
    assert decode_token(refreshed_tokens["access_token"])["roles"] == ["user"]

    assert api_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": tokens["refresh_token"]},
    ).status_code == 401

    logout_response = api_client.post(
        "/api/v1/auth/logout",
        headers={"Authorization": f"Bearer {refreshed_tokens['access_token']}"},
    )
    assert logout_response.status_code == 204
    assert (
        f"revoked:session:{decode_token(tokens['access_token'])['sid']}"
        in api_client.app.state.redis.revoked
    )
    assert api_client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {refreshed_tokens['access_token']}"},
    ).status_code == 401


def test_login_rejects_invalid_credentials(api_client: TestClient) -> None:
    response = api_client.post(
        "/api/v1/auth/login",
        json={"email": "missing@example.com", "password": "MotDePasse-Secure-123"},
    )

    assert response.status_code == 401


def test_logout_all_does_not_block_a_later_login(api_client: TestClient) -> None:
    email = f"{uuid.uuid4()}@example.com"
    password = "MotDePasse-Secure-123"
    assert api_client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Test Utilisateur",
            "email": email,
            "phone_number": "+2250102030405",
            "password": password,
        },
    ).status_code == 201
    first_login = api_client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert first_login.status_code == 200

    logout_response = api_client.post(
        "/api/v1/auth/logout-all",
        headers={"Authorization": f"Bearer {first_login.json()['access_token']}"},
    )
    assert logout_response.status_code == 204

    later_login = api_client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert later_login.status_code == 200
    later_session_id = decode_token(later_login.json()["access_token"])["sid"]
    assert f"revoked:session:{later_session_id}" not in api_client.app.state.redis.revoked


def test_deactivation_revokes_sessions_without_blocking_future_reactivation(
    api_client: TestClient,
) -> None:
    with api_client.app.state.test_session() as db:
        user = User(full_name="Utilisateur cible", email=f"{uuid.uuid4()}@example.com")
        db.add(user)
        db.flush()
        session = UserSession(
            user_id=user.id,
            refresh_token_hash="a" * 64,
            expires_at=datetime.now(timezone.utc) + timedelta(days=1),
        )
        db.add(session)
        db.commit()
        user_id, session_id = user.id, session.id

        asyncio.run(
            UserService.update_user(
                db,
                user_id,
                UserUpdate(is_active=False),
                api_client.app.state.redis,
            )
        )

        assert db.get(User, user_id).is_active is False
        revoked_session = db.get(UserSession, session_id)
        assert revoked_session.revoked_at is not None
        assert revoked_session.refresh_token_hash is None
        assert f"revoked:session:{session_id}" in api_client.app.state.redis.revoked

        asyncio.run(
            UserService.update_user(
                db,
                user_id,
                UserUpdate(is_active=True),
                api_client.app.state.redis,
            )
        )

        assert db.get(User, user_id).is_active is True
        assert f"revoked:user:{user_id}" not in api_client.app.state.redis.revoked


def test_identity_has_no_default_rate_limit() -> None:
    assert limiter._default_limits == []


def test_login_route_injects_rate_limit_headers(
    api_client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    email = f"{uuid.uuid4()}@example.com"
    password = "MotDePasse-Secure-123"
    register_response = api_client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Test Utilisateur",
            "email": email,
            "phone_number": "+2250102030405",
            "password": password,
        },
    )
    assert register_response.status_code == 201

    storage = MemoryStorage()
    monkeypatch.setattr(limiter, "_storage", storage)
    monkeypatch.setattr(limiter, "_limiter", FixedWindowRateLimiter(storage))
    monkeypatch.setattr(limiter, "enabled", True)

    response = api_client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )

    assert response.status_code == 200
    assert "x-ratelimit-limit" in response.headers
    assert "x-ratelimit-remaining" in response.headers


def test_social_nonce_login_creates_account_and_token_wallet(
    api_client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_IDS", "test-google-client")
    nonce_response = api_client.post(
        "/api/v1/auth/social/nonce",
        json={"provider": "google"},
    )
    assert nonce_response.status_code == 200
    nonce = nonce_response.json()["nonce"]
    monkeypatch.setattr(
        "app.features.auth.social._verified_claims",
        lambda provider, id_token: {
            "sub": "google-test-subject",
            "nonce": nonce,
            "email": "social@example.com",
            "email_verified": True,
        },
    )

    login_response = api_client.post(
        "/api/v1/auth/social/login",
        json={
            "provider": "google",
            "id_token": "mocked-provider-token",
            "nonce": nonce,
            "full_name": "Compte Google",
            "phone_number": "+2250102030405",
        },
    )
    assert login_response.status_code == 200
    access_token = login_response.json()["access_token"]
    authorization = {"Authorization": f"Bearer {access_token}"}

    profile_response = api_client.get("/api/v1/users/me", headers=authorization)
    assert profile_response.status_code == 200
    assert profile_response.json()["email"] == "social@example.com"
    assert profile_response.json()["is_verified"] is True

    balance_response = api_client.get("/api/v1/users/me/tokens", headers=authorization)
    assert balance_response.status_code == 200
    assert balance_response.json()["total_tokens"] == settings.FREE_TOKEN_GRANT

    reuse_response = api_client.post(
        "/api/v1/auth/social/login",
        json={
            "provider": "google",
            "id_token": "mocked-provider-token",
            "nonce": nonce,
            "full_name": "Compte Google",
            "phone_number": "+2250102030405",
        },
    )
    assert reuse_response.status_code == 401


def test_token_balance_requires_bearer_authentication(api_client: TestClient) -> None:
    response = api_client.get("/api/v1/users/me/tokens")

    assert response.status_code == 401


def test_login_request_rejects_unknown_fields() -> None:
    with pytest.raises(ValueError, match="Extra inputs are not permitted"):
        LoginRequest.model_validate(
            {
                "email": "user@example.com",
                "password": "safe-password",
                "unexpected": "value",
            }
        )
