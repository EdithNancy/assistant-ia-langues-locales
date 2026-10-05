import asyncio
import logging
import time
import uuid
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from jose import JWTError
from redis.asyncio import Redis
from redis.exceptions import RedisError, ResponseError
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.config import settings
from app.core.rate_limit import limiter
from app.core.security import decode_token
from app.features.auth.routes import router as auth_router
from app.features.users.routes import router as users_router
from app.features.roles.routes import router as roles_router
from app.features.permissions.routes import router as permissions_router
from app.features.sessions.routes import router as sessions_router
from app.features.data.routes import router as data_router
from app.features.usage.routes import router as usage_router
from app.features.usage.service import (
    USAGE_EVENTS_GROUP,
    USAGE_EVENTS_STREAM,
    enqueue_request_usage,
    run_usage_log_worker,
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    redis = Redis.from_url(settings.REDIS_URL, decode_responses=True)
    await redis.ping()
    try:
        await redis.xgroup_create(
            USAGE_EVENTS_STREAM,
            USAGE_EVENTS_GROUP,
            id="0",
            mkstream=True,
        )
    except ResponseError as exc:
        if "BUSYGROUP" not in str(exc):
            raise
    app.state.redis = redis
    stop_worker = asyncio.Event()
    worker = asyncio.create_task(run_usage_log_worker(redis, stop_worker))
    try:
        yield
    finally:
        stop_worker.set()
        await worker
        await redis.aclose()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    debug=settings.DEBUG,
    lifespan=lifespan,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(CORSMiddleware, allow_origins=settings.CORS_ORIGINS,
                   allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
for router in (
    auth_router, users_router, roles_router, permissions_router, sessions_router,
    data_router, usage_router,
):
    app.include_router(router, prefix=settings.API_V1_PREFIX)


@app.middleware("http")
async def log_usage(request: Request, call_next):
    started_at = time.perf_counter()
    response = await call_next(request)
    route = request.scope.get("route")
    route_path = getattr(route, "path", request.url.path)
    user_id = None
    authorization = request.headers.get("authorization", "")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() == "bearer" and token:
        try:
            payload = decode_token(token)
            user_id = uuid.UUID(payload["sub"])
        except (JWTError, ValueError, KeyError, TypeError):
            pass

    try:
        await enqueue_request_usage(
            request.app.state.redis,
            method=request.method,
            route=route_path,
            status_code=response.status_code,
            duration_ms=round((time.perf_counter() - started_at) * 1000),
            user_id=user_id,
        )
    except RedisError:
        logger.exception(
            "Could not enqueue usage event for %s %s (HTTP %s).",
            request.method,
            route_path,
            response.status_code,
        )
    return response


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok", "application": settings.APP_NAME}
