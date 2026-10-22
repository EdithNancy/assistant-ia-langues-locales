import asyncio
import json

import httpx
import pytest
from starlette.requests import Request

from app.auth import User
from app.proxy import forward


class ResponseStream(httpx.AsyncByteStream):
    async def __aiter__(self):
        yield b"created"

    async def aclose(self) -> None:
        return None


def make_request(method: str, path: str) -> Request:
    async def receive() -> dict[str, object]:
        return {"type": "http.request", "body": b"", "more_body": False}

    return Request(
        {
            "type": "http",
            "asgi": {"version": "3.0"},
            "http_version": "1.1",
            "method": method,
            "scheme": "http",
            "path": path,
            "raw_path": path.encode(),
            "query_string": b"",
            "headers": [],
            "client": ("192.0.2.15", 54321),
            "server": ("gateway", 8000),
        },
        receive,
    )


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


def test_forward_wraps_json_success_with_api_envelope() -> None:
    async def exercise() -> tuple[int, dict[str, object], str]:
        async def handler(_request: httpx.Request) -> httpx.Response:
            return httpx.Response(201, json={"id": "scenario-1"})

        client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
        request = make_request("POST", "/api/learning/scenarios")
        response = await forward(
            client, request, "http://learning:8003/scenarios", None, "request-123"
        )
        body = json.loads(response.body)
        await client.aclose()
        return response.status_code, body, response.headers["X-Request-ID"]

    status_code, body, request_id = asyncio.run(exercise())

    assert status_code == 201
    assert body == {
        "code": 201,
        "item": {"id": "scenario-1"},
        "message": "Ressource créée avec succès.",
        "hasError": False,
    }
    assert "pagination" not in body
    assert "errorCode" not in body
    assert request_id == "request-123"


def test_forward_adds_http_code_to_existing_api_envelope() -> None:
    async def exercise() -> dict[str, object]:
        async def handler(_request: httpx.Request) -> httpx.Response:
            return httpx.Response(
                201,
                json={
                    "code": 200,
                    "item": {"id": "user-1"},
                    "message": "Succès",
                    "hasError": False,
                },
            )

        client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
        request = make_request("POST", "/api/users")
        response = await forward(
            client, request, "http://identity:8001/api/v1/users", None, "rid"
        )
        body = json.loads(response.body)
        await client.aclose()
        return body

    body = asyncio.run(exercise())

    assert body == {
        "code": 201,
        "item": {"id": "user-1"},
        "message": "Succès",
        "hasError": False,
    }


def test_forward_logs_upstream_transport_failure_without_exposing_details(
    caplog: pytest.LogCaptureFixture,
) -> None:
    async def exercise() -> tuple[int, dict[str, object]]:
        async def handler(_request: httpx.Request) -> httpx.Response:
            raise httpx.ConnectError("connection refused")

        client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
        request = make_request("POST", "/api/auth/register")
        response = await forward(
            client,
            request,
            "http://identity:8001/api/v1/auth/register",
            None,
            "request-456",
        )
        body = json.loads(response.body)
        await client.aclose()
        return response.status_code, body

    status_code, body = asyncio.run(exercise())

    assert status_code == 502
    assert body["code"] == 502
    assert body["hasError"] is True
    assert "rid=request-456 error_type=ConnectError" in caplog.text
    assert "connection refused" not in caplog.text


def test_forward_preserves_upstream_error_status_when_json_is_not_utf8(
    caplog: pytest.LogCaptureFixture,
) -> None:
    async def exercise() -> tuple[int, dict[str, object]]:
        async def handler(_request: httpx.Request) -> httpx.Response:
            return httpx.Response(
                409,
                headers={"content-type": "application/json"},
                content=b"\xff",
            )

        client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
        request = make_request("POST", "/api/auth/register")
        response = await forward(
            client,
            request,
            "http://identity:8001/api/v1/auth/register",
            None,
            "request-789",
        )
        body = json.loads(response.body)
        await client.aclose()
        return response.status_code, body

    status_code, body = asyncio.run(exercise())

    assert status_code == 409
    assert body["code"] == 409
    assert body["hasError"] is True
    assert body["message"] == "La requête entre en conflit avec l’état actuel."
    assert "rid=request-789 error_type=UnicodeDecodeError" in caplog.text


def test_forward_normalizes_upstream_validation_errors_without_echoing_input() -> None:
    async def exercise() -> tuple[int, dict[str, object]]:
        async def handler(_request: httpx.Request) -> httpx.Response:
            return httpx.Response(
                422,
                json={
                    "detail": [
                        {
                            "loc": ["body", "password"],
                            "msg": "String should have at least 10 characters",
                            "input": "secret-value",
                        }
                    ]
                },
            )

        client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
        request = make_request("POST", "/api/auth/register")
        response = await forward(
            client, request, "http://identity:8001/api/v1/auth/register", None, "rid"
        )
        body = json.loads(response.body)
        await client.aclose()
        return response.status_code, body

    status_code, body = asyncio.run(exercise())

    assert status_code == 422
    assert body["code"] == 422
    assert body["hasError"] is True
    assert body["message"] == "String should have at least 10 characters"
    assert "pagination" not in body
    assert "errorCode" not in body
    assert "secret-value" not in json.dumps(body)


def test_forward_sanitizes_upstream_server_errors() -> None:
    async def exercise() -> tuple[int, dict[str, object]]:
        async def handler(_request: httpx.Request) -> httpx.Response:
            return httpx.Response(500, json={"detail": "database password leaked"})

        client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
        request = make_request("GET", "/api/users/me")
        response = await forward(
            client, request, "http://identity:8001/api/v1/users/me", None, "rid"
        )
        body = json.loads(response.body)
        await client.aclose()
        return response.status_code, body

    status_code, body = asyncio.run(exercise())

    assert status_code == 500
    assert body["code"] == 500
    assert body["hasError"] is True
    assert body["message"] == "Une erreur interne est survenue."
    assert "pagination" not in body
    assert "errorCode" not in body
    assert "database password leaked" not in json.dumps(body)


def test_forward_includes_pagination_only_for_paginated_lists() -> None:
    async def exercise() -> dict[str, object]:
        async def handler(_request: httpx.Request) -> httpx.Response:
            return httpx.Response(
                200,
                json={
                    "items": [{"id": "user-1"}],
                    "pagination": {
                        "offset": 10,
                        "limit": 10,
                        "total": 11,
                        "hasMore": True,
                    },
                },
            )

        client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
        request = make_request("GET", "/api/users?offset=10&limit=10")
        response = await forward(
            client, request, "http://identity:8001/api/v1/users", None, "rid"
        )
        body = json.loads(response.body)
        await client.aclose()
        return body

    body = asyncio.run(exercise())

    assert body["item"] == [{"id": "user-1"}]
    assert body["code"] == 200
    assert body["pagination"] == {
        "offset": 10,
        "limit": 10,
        "total": 11,
        "hasMore": True,
    }


def test_forward_preserves_no_content_responses() -> None:
    async def exercise() -> tuple[int, bytes]:
        async def handler(_request: httpx.Request) -> httpx.Response:
            return httpx.Response(204)

        client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
        request = make_request("DELETE", "/api/conversations/c-1")
        response = await forward(
            client, request, "http://conversation:8002/c-1", None, "rid"
        )
        body = response.body
        await client.aclose()
        return response.status_code, body

    status_code, body = asyncio.run(exercise())

    assert status_code == 204
    assert body == b""
