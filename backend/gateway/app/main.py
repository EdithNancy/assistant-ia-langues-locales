import logging
import re
import asyncio
from urllib.parse import quote, urlencode
import time
import uuid
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, HTTPException, Request, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from redis.exceptions import RedisError
from starlette.requests import HTTPConnection

from backend_observability import instrument_app

from .auth import User, bearer, decode_token
from .config import settings
from .proxy import forward, proxy_websocket
from .ratelimit import RateLimiter

log = logging.getLogger("gateway")
logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s %(levelname)s %(message)s")

@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.validate()
    app.state.limiter = RateLimiter(
        settings.redis_url, settings.rate_limit, settings.rate_window
    )
    app.state.http = httpx.AsyncClient(
        timeout=settings.upstream_timeout, follow_redirects=False, trust_env=False
    )
    try:
        yield
    finally:
        await app.state.http.aclose()
        await app.state.limiter.close()
        observability.shutdown()


app = FastAPI(title="API Gateway", lifespan=lifespan)
observability = instrument_app(app, "gateway")

if settings.cors_origins:
    app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins,
                       allow_methods=["*"], allow_headers=["*"], allow_credentials=True)


@app.middleware("http")
async def request_context(request: Request, call_next):
    supplied_id = request.headers.get("X-Request-ID", "")
    request.state.request_id = (
        supplied_id if re.fullmatch(r"[A-Za-z0-9._-]{1,64}", supplied_id) else uuid.uuid4().hex
    )
    start = time.perf_counter()
    response = await call_next(request)
    response.headers["X-Request-ID"] = request.state.request_id
    route = request.scope.get("route")
    route_path = getattr(route, "path", "<unmatched>")
    log.info("%s %s -> %s (%.0f ms) rid=%s", request.method, route_path,
             response.status_code, (time.perf_counter() - start) * 1000, request.state.request_id)
    return response


def check_role(user: User, roles: frozenset[str] | None):
    if roles and not user.roles.intersection(roles):
        raise HTTPException(403, "Accès refusé pour ce rôle")


async def check_session(request: HTTPConnection, user: User) -> None:
    try:
        revoked = await request.app.state.limiter.is_revoked(user.session_id)
    except RedisError:
        log.exception("Session revocation check failed")
        raise HTTPException(503, "Vérification de session indisponible")
    if revoked:
        raise HTTPException(
            401,
            "Session révoquée",
            headers={"WWW-Authenticate": "Bearer"},
        )


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/ready")
async def ready(request: Request):
    try:
        await request.app.state.limiter.check()
    except RedisError:
        log.exception("Rate-limit Redis is unavailable")
        return JSONResponse({"status": "not_ready"}, status_code=503)
    upstreams = {
        "identity": settings.routes["auth"].upstream.removesuffix("/api/v1/auth"),
        "conversation": settings.routes["conversations"].upstream,
        "learning": settings.routes["learning"].upstream,
    }

    async def check_upstream(service: str, upstream: str) -> str | None:
        try:
            response = await request.app.state.http.get(
                f"{upstream.rstrip('/')}/ready",
                timeout=2,
            )
            response.raise_for_status()
        except httpx.HTTPError:
            log.exception("Gateway readiness check failed for %s", service)
            return service
        return None

    unhealthy = await asyncio.gather(
        *(check_upstream(service, upstream) for service, upstream in upstreams.items())
    )
    if service := next((service for service in unhealthy if service), None):
        return JSONResponse(
            {"status": "not_ready", "service": service},
            status_code=503,
        )
    return {"status": "ready"}


@app.api_route(
    "/api/{service}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
)
@app.api_route(
    "/api/{service}/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
)
async def gateway(service: str, request: Request, path: str = ""):
    route = settings.routes.get(service)

    if not route:
        raise HTTPException(status_code=404, detail="Service inconnu")

    # Normaliser le chemin pour éviter les problèmes de slash
    normalized_path = path.strip("/")
    public_paths = {p.strip("/") for p in route.public_paths}
    is_public = normalized_path in public_paths

    # Authentification et contrôle des rôles
    user: User | None = None

    if not is_public:
        token = bearer(request.headers.get("Authorization"))

        if not token:
            raise HTTPException(
                status_code=401,
                detail="Authentification requise",
                headers={"WWW-Authenticate": "Bearer"},
            )

        user = decode_token(token)
        await check_session(request, user)
        check_role(user, route.roles)

    # Limitation du nombre de requêtes
    key = (
        f"user:{user.id}"
        if user
        else f"ip:{request.client.host if request.client else 'unknown'}"
    )

    try:
        allowed, retry = await request.app.state.limiter.hit(key)
    except RedisError:
        log.exception("Rate-limit Redis is unavailable")
        raise HTTPException(503, "Contrôle de débit indisponible")

    if not allowed:
        return JSONResponse(
            {"detail": "Trop de requêtes"},
            status_code=429,
            headers={"Retry-After": str(retry)},
        )

    # Construire l'URL du service en aval
    encoded_path = quote(normalized_path, safe="/:@!$&'()*+,;=-._~")
    url = f"{route.upstream.rstrip('/')}/{encoded_path}"

    log.info(
        "Proxy vers service=%s method=%s rid=%s",
        service,
        request.method,
        request.state.request_id,
    )

    return await forward(
        request.app.state.http,
        request,
        url,
        user,
        request.state.request_id,
    )


@app.websocket("/ws/{name}")
async def websocket_gateway(ws: WebSocket, name: str):
    upstream = settings.ws_routes.get(name)
    # Navigateur : ?token=...   |   React Native : header Authorization
    token = ws.query_params.get("token") or bearer(
        ws.headers.get("Authorization"))
    if not upstream:
        await ws.close(code=4404)
        return
    if not token:
        await ws.close(code=4401)
        return
    try:
        user = decode_token(token)
    except HTTPException:
        await ws.close(code=4401)
        return
    try:
        await check_session(ws, user)
    except HTTPException as exc:
        await ws.close(code=1013 if exc.status_code == 503 else 4401)
        return
    try:
        allowed, _ = await ws.app.state.limiter.hit(f"ws:{user.id}")
    except RedisError:
        log.exception("Rate-limit Redis is unavailable for WebSocket")
        await ws.close(code=1013)
        return
    if not allowed:
        await ws.close(code=4429)
        return
    # on relaie les paramètres (ex: conversation_id) sauf le token
    params = {k: v for k, v in ws.query_params.items() if k != "token"}
    if params:
        upstream = f"{upstream}?{urlencode(params)}"
    await proxy_websocket(ws, upstream, user, uuid.uuid4().hex)
