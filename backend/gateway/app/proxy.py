import asyncio
import json
import logging

import httpx
import websockets
from fastapi import Request, WebSocket
from fastapi.responses import JSONResponse, Response, StreamingResponse
from starlette.background import BackgroundTask

from .auth import User
from .api_response import error_payload, success_payload

log = logging.getLogger("gateway.proxy")

HOP_BY_HOP = {
    "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
    "te", "trailers", "transfer-encoding", "upgrade", "host", "content-length",
}
FORWARDED_HEADERS = {"forwarded", "x-forwarded-for", "x-forwarded-host",
                     "x-forwarded-port", "x-forwarded-proto", "x-real-ip",
                     "x-token-usage-source"}


def _excluded_headers(headers) -> set[str]:
    excluded = set(HOP_BY_HOP) | FORWARDED_HEADERS
    excluded.update(
        value.strip().lower()
        for header, value in headers.items()
        if header.lower() == "connection"
        for value in value.split(",")
        if value.strip()
    )
    return excluded


def user_headers(user: User | None, request_id: str) -> dict[str, str]:
    h = {"X-Request-ID": request_id}
    if user:
        h["X-User-Id"] = user.id
        h["X-User-Role"] = user.role
        h["X-User-Roles"] = ",".join(sorted(user.roles))
    return h


async def forward(client: httpx.AsyncClient, request: Request, url: str,
                  user: User | None, request_id: str):
    # On retire tout X-User-* envoyé par le client : seule la gateway les pose.
    excluded = _excluded_headers(request.headers)
    headers = {
        k: v for k, v in request.headers.items()
        if k.lower() not in excluded and not k.lower().startswith("x-user-")
    }
    headers.update(user_headers(user, request_id))
    if request.client:
        headers["X-Forwarded-For"] = request.client.host
    headers["X-Forwarded-Proto"] = request.url.scheme
    try:
        req = client.build_request(
            request.method, url, params=request.query_params,
            headers=headers, content=await request.body(),
        )
        resp = await client.send(req, stream=True)
    except httpx.TimeoutException as exc:
        log.warning(
            "Upstream request timed out rid=%s error_type=%s",
            request_id,
            type(exc).__name__,
        )
        return JSONResponse(
            error_payload(504, "Service en aval trop lent"),
            status_code=504,
            headers={"X-Request-ID": request_id},
        )
    except httpx.HTTPError as exc:
        log.warning(
            "Upstream transport failed rid=%s error_type=%s",
            request_id,
            type(exc).__name__,
        )
        return JSONResponse(
            error_payload(502, "Service en aval indisponible"),
            status_code=502,
            headers={"X-Request-ID": request_id},
        )

    out_headers = {k: v for k, v in resp.headers.items()
                   if k.lower() not in _excluded_headers(resp.headers) | {"content-length"}}
    out_headers["X-Request-ID"] = request_id

    if resp.status_code in {204, 304}:
        await resp.aclose()
        return Response(status_code=resp.status_code, headers=out_headers)

    content_type = resp.headers.get(
        "content-type", "").split(";", 1)[0].lower()
    is_json = content_type == "application/json" or content_type.endswith(
        "+json")
    if is_json or resp.status_code >= 400:
        try:
            await resp.aread()
        except httpx.TimeoutException as exc:
            log.warning(
                "Upstream response timed out rid=%s error_type=%s",
                request_id,
                type(exc).__name__,
            )
            await resp.aclose()
            return JSONResponse(
                error_payload(504),
                status_code=504,
                headers={"X-Request-ID": request_id},
            )
        except httpx.HTTPError as exc:
            log.warning(
                "Upstream response read failed rid=%s error_type=%s",
                request_id,
                type(exc).__name__,
            )
            await resp.aclose()
            return JSONResponse(
                error_payload(502),
                status_code=502,
                headers={"X-Request-ID": request_id},
            )

        payload = None
        if is_json:
            log.info(
                "Upstream JSON diagnostic rid=%s status=%s "
                "content_type=%r encoding=%r content_encoding=%r "
                "body_length=%s body_prefix_hex=%s",
                request_id,
                resp.status_code,
                resp.headers.get("content-type"),
                resp.encoding,
                resp.headers.get("content-encoding"),
                len(resp.content),
                resp.content[:24].hex(),
            )
            try:
                payload = json.loads(
                    resp.content.decode(resp.encoding or "utf-8")
                )
            except (ValueError, UnicodeError) as exc:
                log.warning(
                    "Upstream returned invalid JSON rid=%s error_type=%s",
                    request_id,
                    type(exc).__name__,
                )

                if resp.status_code < 400:
                    await resp.aclose()
                    return JSONResponse(
                        error_payload(502),
                        status_code=502,
                        headers={"X-Request-ID": request_id},
                    )

                payload = None

        headers = {
            key: value
            for key, value in out_headers.items()
            if key.lower() not in {"content-type", "content-encoding"}
        }
        await resp.aclose()

        if resp.status_code >= 400:
            detail = payload
            if isinstance(payload, dict):
                detail = payload.get(
                    "detail",
                    payload.get("message", payload.get("error")),
                )

            request_path = request.url.path.rstrip("/")

            if (
                resp.status_code == 401
                and request.method == "POST"
                and request_path.endswith("/auth/login")
            ):
                detail = "Identifiant ou mot de passe incorrect."

            elif (
                resp.status_code == 409
                and request.method == "POST"
                and request_path.endswith("/auth/register")
                and payload is None
            ):
                detail = (
                    "Le compte n'a pas pu être créé car une donnée "
                    "entre en conflit avec les données enregistrées. "
                    "Vérifiez l'adresse e-mail et réessayez."
                )

            return JSONResponse(
                error_payload(resp.status_code, detail),
                status_code=resp.status_code,
                headers=headers,
            )

        return JSONResponse(
            success_payload(payload, resp.status_code),
            status_code=resp.status_code,
            headers=headers,
        )

    return StreamingResponse(resp.aiter_raw(), status_code=resp.status_code,
                             headers=out_headers, background=BackgroundTask(resp.aclose))


async def proxy_websocket(
    ws: WebSocket,
    upstream_url: str,
    user: User,
    request_id: str,
    authorization: str,
):
    """Relais bidirectionnel texte/binaire (audio temps réel) client <-> service aval."""
    await ws.accept()
    try:
        headers = user_headers(user, request_id)
        headers["Authorization"] = authorization
        async with websockets.connect(
            upstream_url, additional_headers=headers,
            max_size=1_000_000, ping_interval=20,
        ) as upstream:
            async def client_to_upstream():
                while True:
                    msg = await ws.receive()
                    if msg["type"] == "websocket.disconnect":
                        return
                    if msg.get("bytes") is not None:
                        await upstream.send(msg["bytes"])
                    elif msg.get("text") is not None:
                        await upstream.send(msg["text"])

            async def upstream_to_client():
                async for msg in upstream:
                    if isinstance(msg, bytes):
                        await ws.send_bytes(msg)
                    else:
                        await ws.send_text(msg)

            tasks = [asyncio.create_task(client_to_upstream()),
                     asyncio.create_task(upstream_to_client())]
            done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
            for t in pending:
                t.cancel()
            await asyncio.gather(*pending, return_exceptions=True)
            for task in done:
                task.result()
    except (OSError, websockets.WebSocketException):
        try:
            await ws.close(code=1011)
        except RuntimeError:
            pass
    finally:
        try:
            await ws.close()
        except Exception:  # client déjà déconnecté
            pass
# End of file
