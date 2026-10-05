import json
import unittest
import uuid
from datetime import datetime, timezone

from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from app.core.database import Base
from app.features.auth.social import FederatedIdentity, SocialAuthNonce
from app.features.data.entity import Language, VocabularyEntry
from app.features.permissions.entity import Permission
from app.features.roles.entity import Role
from app.features.sessions.entity import UserSession
from app.features.tokens.entity import TokenTransaction, TokenWallet
from app.features.usage.entity import UsageEvent
from app.features.usage.service import (
    enqueue_usage_event,
    event_type_for,
    persist_usage_event,
)
from app.features.users.entity import User


class UsageAuditTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite://")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine, expire_on_commit=False)
        self.user = User(
            full_name="Audit user",
            email=f"{uuid.uuid4()}@example.com",
            phone_number="+2250102030405",
            password_hash=None,
        )
        self.db.add(self.user)
        self.db.commit()

    def tearDown(self) -> None:
        self.db.close()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    def test_persists_buffered_event_once(self) -> None:
        event_id = uuid.uuid4()
        created_at = datetime.now(timezone.utc).isoformat()
        fields = {
            "id": str(event_id),
            "event_type": "data.entry.create",
            "user_id": str(self.user.id),
            "method": "POST",
            "route": "/api/v1/data/entries",
            "status_code": "201",
            "duration_ms": "32",
            "details": json.dumps({"kind": "word"}),
            "created_at": created_at,
        }

        persist_usage_event(self.db, fields)
        persist_usage_event(self.db, fields)

        self.assertEqual(
            self.db.scalar(select(func.count()).select_from(UsageEvent)),
            1,
        )
        event = self.db.get(UsageEvent, event_id)
        self.assertEqual(event.user_id, self.user.id)
        self.assertEqual(event.details, {"kind": "word"})

    def test_enqueue_writes_to_redis_stream_without_request_secrets(self) -> None:
        class RedisStreamStub:
            def __init__(self) -> None:
                self.stream = None
                self.fields = None

            async def xadd(self, stream, fields):
                self.stream = stream
                self.fields = fields
                return "1-0"

        import asyncio

        redis = RedisStreamStub()
        event_id = asyncio.run(enqueue_usage_event(redis, {
            "event_type": "auth.login",
            "user_id": self.user.id,
            "method": "POST",
            "route": "/api/v1/auth/login",
            "status_code": 200,
            "duration_ms": 12,
        }))

        self.assertEqual(event_id, redis.fields["id"])
        self.assertEqual(redis.stream, "app:usage:events")
        self.assertEqual(redis.fields["details"], "{}")
        self.assertNotIn("password", redis.fields)
        self.assertNotIn("authorization", redis.fields)

    def test_classifies_auth_and_vocabulary_actions_without_payloads(self) -> None:
        self.assertEqual(
            event_type_for("POST", "/api/v1/auth/login", 200),
            "auth.login",
        )
        self.assertEqual(
            event_type_for("POST", "/api/v1/auth/login", 401),
            "auth.failed",
        )
        self.assertEqual(
            event_type_for("DELETE", "/api/v1/data/entries/{entry_id}", 204),
            "data.entry.delete",
        )


if __name__ == "__main__":
    unittest.main()
