import asyncio

import httpx
from starlette.requests import Request

from app.auth import User
from app.proxy import forward


class ResponseStream(httpx.AsyncByteStream):
    async def __aiter__(self):
        yield b"created"

    async def aclose(self) -> None:
        return None


def test_forward_replaces_identity_and_forwarding_headers() -> None:
    received: dict[str, object] = {}

    async def exercise() -> tuple[httpx.Response, httpx.AsyncClient]:
        async def handler(upstream_request: httpx.Request) -> httpx.Response:
            received["headers"] = upstream_request.headers
            received["body"] = await upstream_request.aread()
            return httpx.Response(201, stream=ResponseStream())

        client = httpx.AsyncClient(transport=httpx.MockTransport(handler))

        async def receive() -> dict[str, object]:
            return {"type": "http.request", "body": b"payload", "more_body": False}

        request = Request(
            {
                "type": "http",
                "asgi": {"version": "3.0"},
                "http_version": "1.1",
                "method": "POST",
                "scheme": "http",
                "path": "/api/auth/login",
                "raw_path": b"/api/auth/login",
                "query_string": b"next=%2Fusers",
                "headers": [
                    (b"x-user-id", b"forged-user"),
                    (b"x-forwarded-for", b"198.51.100.99"),
                    (b"connection", b"x-private"),
                    (b"x-private", b"secret"),
                ],
                "client": ("192.0.2.15", 54321),
                "server": ("gateway", 8000),
            },
            receive,
        )
        response = await forward(
            client,
            request,
            "http://identity:8001/api/v1/auth/login",
            User(
                id="actual-user",
                roles=frozenset({"user"}),
                session_id="45f151c3-4702-4eb0-8d71-80213b716a66",
            ),
            "request-123",
        )
        return response, client

    response, client = asyncio.run(exercise())

    async def finish() -> bytes:
        body = b"".join([part async for part in response.body_iterator])
        if response.background:
            await response.background()
        await client.aclose()
        return body

    body = asyncio.run(finish())
    headers = received["headers"]
    assert body == b"created"
    assert received["body"] == b"payload"
    assert headers["x-user-id"] == "actual-user"
    assert headers["x-forwarded-for"] == "192.0.2.15"
    assert "x-private" not in headers
