import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Protocol

from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.features.usage.entity import UsageEvent


logger = logging.getLogger(__name__)
USAGE_EVENTS_STREAM = "app:usage:events"
USAGE_EVENTS_GROUP = "usage-database-writers"


class UsageStream(Protocol):
    async def xadd(self, name: str, fields: dict[str, str]) -> Any: ...


_ACTION_ROUTES = {
    ("POST", "/auth/register"): "auth.register",
    ("POST", "/auth/login"): "auth.login",
    ("POST", "/auth/social/nonce"): "auth.social_nonce",
    ("POST", "/auth/social/login"): "auth.social_login",
    ("POST", "/auth/refresh"): "auth.refresh",
    ("POST", "/auth/logout"): "auth.logout",
    ("POST", "/auth/logout-all"): "auth.logout_all",
    ("POST", "/data/languages"): "data.language.create",
    ("PATCH", "/data/languages/{language_id}"): "data.language.update",
    ("POST", "/data/entries"): "data.entry.create",
    ("PATCH", "/data/entries/{entry_id}"): "data.entry.update",
    ("DELETE", "/data/entries/{entry_id}"): "data.entry.delete",
    ("POST", "/users"): "user.create",
    ("PATCH", "/users/{user_id}"): "user.update",
    ("GET", "/users/me/tokens"): "tokens.balance.read",
}


def event_type_for(method: str, route: str, status_code: int) -> str:
    method = method.upper()
    route_suffix = route[route.find("/auth/"):] if "/auth/" in route else route
    if route_suffix == "/auth/" and route.endswith("/auth"):
        route_suffix = "/auth"
    if route_suffix.startswith("/auth/") and status_code >= 400:
        return "auth.failed"
    if route_suffix in {"/auth/register", "/auth/login", "/auth/social/nonce",
                        "/auth/social/login", "/auth/refresh", "/auth/logout",
                        "/auth/logout-all"}:
        return _ACTION_ROUTES.get((method, route_suffix), "api.request")
    for (action_method, action_route), event_type in _ACTION_ROUTES.items():
        if method == action_method and route.endswith(action_route):
            return event_type
    return "api.request"


async def enqueue_usage_event(redis: UsageStream, event: dict[str, Any]) -> str:
    event_id = str(event.get("id") or uuid.uuid4())
    payload = {
        "id": event_id,
        "event_type": str(event["event_type"]),
        "user_id": str(event["user_id"]) if event.get("user_id") else "",
        "method": str(event["method"]),
        "route": str(event["route"]),
        "status_code": str(event["status_code"]),
        "duration_ms": str(event["duration_ms"]),
        "details": json.dumps(event.get("details") or {}, separators=(",", ":")),
        "created_at": str(event.get("created_at") or datetime.now(timezone.utc).isoformat()),
    }
    await redis.xadd(USAGE_EVENTS_STREAM, payload)
    return event_id


def persist_usage_event(db: Session, fields: dict[str, Any]) -> None:
    event_id = uuid.UUID(_decode(fields["id"]))
    if db.get(UsageEvent, event_id) is not None:
        return

    raw_user_id = _decode(fields.get("user_id", ""))
    raw_details = _decode(fields.get("details", "{}"))
    details = json.loads(raw_details)
    if not isinstance(details, dict):
        raise ValueError("Usage event details must be an object.")
    created_at = datetime.fromisoformat(_decode(fields["created_at"]))
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)

    event = UsageEvent(
        id=event_id,
        event_type=_decode(fields["event_type"]),
        user_id=uuid.UUID(raw_user_id) if raw_user_id else None,
        method=_decode(fields["method"]),
        route=_decode(fields["route"]),
        status_code=int(_decode(fields["status_code"])),
        duration_ms=max(0, int(_decode(fields["duration_ms"]))),
        details=details,
        created_at=created_at,
    )
    db.add(event)
    db.commit()


def _decode(value: Any) -> str:
    return value.decode() if isinstance(value, bytes) else str(value)


async def run_usage_log_worker(redis: Redis, stop_event: asyncio.Event) -> None:
    from redis.exceptions import RedisError
    from sqlalchemy.exc import SQLAlchemyError

    from app.core.database import SessionLocal

    consumer = f"usage-writer-{uuid.uuid4()}"
    while not stop_event.is_set():
        try:
            claimed = await redis.xautoclaim(
                USAGE_EVENTS_STREAM,
                USAGE_EVENTS_GROUP,
                consumer,
                min_idle_time=30_000,
                start_id="0-0",
                count=100,
            )
            messages = claimed[1]
            if not messages:
                response = await redis.xreadgroup(
                    USAGE_EVENTS_GROUP,
                    consumer,
                    {USAGE_EVENTS_STREAM: ">"},
                    count=100,
                    block=1000,
                )
                messages = response[0][1] if response else []

            for message_id, fields in messages:
                try:
                    await asyncio.to_thread(_persist_usage_event, SessionLocal, fields)
                except (SQLAlchemyError, ValueError, KeyError, TypeError):
                    logger.exception(
                        "Failed to persist usage event %s; it remains queued for retry.",
                        message_id,
                    )
                    break
                await redis.xack(USAGE_EVENTS_STREAM, USAGE_EVENTS_GROUP, message_id)
                await redis.xdel(USAGE_EVENTS_STREAM, message_id)
        except RedisError:
            logger.exception("Usage-log Redis worker failed; retrying shortly.")
            await asyncio.sleep(2)


def _persist_usage_event(session_factory, fields: dict[str, Any]) -> None:
    with session_factory() as db:
        persist_usage_event(db, fields)


async def enqueue_request_usage(
    redis: Redis,
    *,
    method: str,
    route: str,
    status_code: int,
    duration_ms: int,
    user_id: uuid.UUID | None,
) -> None:
    event = {
        "id": uuid.uuid4(),
        "event_type": event_type_for(method, route, status_code),
        "user_id": user_id,
        "method": method,
        "route": route,
        "status_code": status_code,
        "duration_ms": duration_ms,
    }
    await enqueue_usage_event(redis, event)
