import json
import unittest
import uuid
import asyncio
from datetime import datetime, timezone
from unittest.mock import patch

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
    MAX_USAGE_EVENT_ATTEMPTS,
    USAGE_EVENTS_DEAD_LETTER_STREAM,
    USAGE_EVENTS_GROUP,
    USAGE_EVENTS_RETRY_PREFIX,
    USAGE_EVENTS_STREAM,
    enqueue_usage_event,
    event_type_for,
    persist_usage_event,
    run_usage_log_worker,
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

    def test_usage_worker_dead_letters_an_event_after_bounded_retries(self) -> None:
        class RedisStub:
            def __init__(self) -> None:
                self.attempts = 0
                self.dead_letter = None
                self.acknowledged = []
                self.deleted = []
                self.removed_keys = []
                self.stop_event = None

            async def xautoclaim(self, *_args, **_kwargs):
                if self.deleted:
                    return "0-0", []
                return "0-0", [("1-0", {"id": "bad-event"})]

            async def xreadgroup(self, *_args, **_kwargs):
                raise AssertionError("The worker should finish after dead-lettering.")

            async def incr(self, _key):
                self.attempts += 1
                return self.attempts

            async def expire(self, *_args):
                return True

            async def xadd(self, stream, fields):
                self.dead_letter = (stream, fields)

            async def xack(self, stream, group, message_id):
                self.acknowledged.append((stream, group, message_id))

            async def xdel(self, stream, message_id):
                self.deleted.append((stream, message_id))
                self.stop_event.set()

            async def delete(self, key):
                self.removed_keys.append(key)

        async def fail_to_persist(*_args):
            raise ValueError("invalid event")

        async def exercise() -> RedisStub:
            redis = RedisStub()
            stop_event = asyncio.Event()
            redis.stop_event = stop_event
            with patch(
                "app.features.usage.service._persist_usage_event",
                side_effect=fail_to_persist,
            ):
                await run_usage_log_worker(redis, stop_event)
            return redis

        redis = asyncio.run(exercise())

        assert redis.attempts == MAX_USAGE_EVENT_ATTEMPTS
        assert redis.dead_letter is not None
        assert redis.dead_letter[0] == USAGE_EVENTS_DEAD_LETTER_STREAM
        assert json.loads(redis.dead_letter[1]["event"]) == {"id": "bad-event"}
        assert redis.acknowledged == [
            (USAGE_EVENTS_STREAM, USAGE_EVENTS_GROUP, "1-0")
        ]
        assert redis.deleted == [(USAGE_EVENTS_STREAM, "1-0")]
        assert redis.removed_keys == [f"{USAGE_EVENTS_RETRY_PREFIX}:1-0"]


if __name__ == "__main__":
    unittest.main()
