import asyncio

import httpx

from app import billing
from app.ml import DialogueReply


def test_charge_reply_sends_usage_and_bearer_to_identity(monkeypatch) -> None:
    requests = []

    async def handle(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, json={"total_tokens": 17})

    async def exercise() -> None:
        monkeypatch.setattr(billing.config, "IDENTITY_URL", "http://identity:8001")
        async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
            await billing.charge_reply(
                client,
                "Bearer access-token",
                DialogueReply("Réponse", input_tokens=12, output_tokens=5),
            )

    asyncio.run(exercise())

    assert len(requests) == 1
    assert requests[0].method == "POST"
    assert requests[0].url.path == "/api/v1/users/me/tokens/consume"
    assert requests[0].headers["authorization"] == "Bearer access-token"
    assert requests[0].headers["x-token-usage-source"] == "conversation"
    assert requests[0].read() == b'{"credit_tokens":17}'
