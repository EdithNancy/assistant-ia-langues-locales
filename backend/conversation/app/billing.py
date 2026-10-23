import httpx
from fastapi import HTTPException

from . import config
from .ml import DialogueReply


def _authorization_header(authorization: str | None) -> dict[str, str]:
    parts = authorization.split() if authorization else []
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(401, "Authentification requise pour débiter les jetons.")
    return {"Authorization": authorization}


async def _identity_request(
    client: httpx.AsyncClient,
    authorization: str | None,
    method: str,
    path: str,
    **kwargs,
) -> dict:
    headers = _authorization_header(authorization)
    if method == "POST":
        headers["X-Token-Usage-Source"] = "conversation"
    try:
        response = await client.request(
            method,
            f"{config.IDENTITY_URL}/api/v1/users/me/tokens{path}",
            headers=headers,
            **kwargs,
        )
    except httpx.HTTPError as exc:
        raise HTTPException(503, "Le service de jetons est indisponible.") from exc

    if response.status_code == 401:
        raise HTTPException(401, "Session invalide pour le service de jetons.")
    if response.status_code == 402:
        raise HTTPException(402, "Jetons insuffisants. Attendez le prochain renouvellement.")
    if response.is_error:
        raise HTTPException(503, "Le service de jetons n'a pas pu traiter la demande.")
    return response.json()


async def require_available_token(
    client: httpx.AsyncClient, authorization: str | None
) -> None:
    balance = await _identity_request(client, authorization, "GET", "")
    if balance["total_tokens"] < 1:
        raise HTTPException(402, "Jetons insuffisants. Attendez le prochain renouvellement.")


async def charge_reply(
    client: httpx.AsyncClient,
    authorization: str | None,
    reply: DialogueReply,
) -> None:
    if reply.input_tokens < 0 or reply.output_tokens < 0:
        raise HTTPException(502, "Le modèle a renvoyé un comptage de jetons invalide.")
    if reply.total_tokens == 0:
        return
    await _identity_request(
        client,
        authorization,
        "POST",
        "/consume",
        json={"credit_tokens": reply.total_tokens},
    )
