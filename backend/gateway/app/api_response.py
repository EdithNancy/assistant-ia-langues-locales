from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class Pagination(BaseModel):
    offset: int
    limit: int
    total: int
    has_more: bool = Field(serialization_alias="hasMore")


class ApiResponse(BaseModel):
    item: Any = None
    message: str
    has_error: bool = Field(alias="hasError")
    pagination: Pagination | dict[str, Any] | None = None

    model_config = ConfigDict(populate_by_name=True)


def success_message(status_code: int) -> str:
    if status_code == 201:
        return "Ressource créée avec succès."
    if status_code == 202:
        return "Requête acceptée."
    return "Requête traitée avec succès."


def success_payload(
    item: Any,
    status_code: int,
    pagination: Pagination | dict[str, Any] | None = None,
) -> dict[str, Any]:
    if isinstance(item, dict) and {"item", "message", "hasError"}.issubset(item):
        response = {
            "item": item["item"],
            "message": item["message"],
            "hasError": item["hasError"],
        }
        if item.get("pagination") is not None:
            response["pagination"] = item["pagination"]
        return response

    if isinstance(item, dict) and "items" in item and "pagination" in item:
        pagination = item["pagination"]
        item = item["items"]

    response = ApiResponse(
        item=item,
        message=success_message(status_code),
        has_error=False,
        pagination=pagination,
    ).model_dump(mode="json", by_alias=True, exclude_none=True)
    response["item"] = item
    if pagination is not None:
        response["pagination"] = (
            pagination.model_dump(mode="json", by_alias=True)
            if isinstance(pagination, Pagination)
            else pagination
        )
    return response


def error_message(detail: Any, status_code: int) -> str:
    if status_code >= 500:
        return {
            502: "Le service demandé est indisponible.",
            503: "Le service est temporairement indisponible.",
            504: "Le service demandé a dépassé le délai autorisé.",
        }.get(status_code, "Une erreur interne est survenue.")

    if isinstance(detail, str) and detail.strip():
        return detail.strip()
    if isinstance(detail, dict):
        for key in ("message", "detail", "error"):
            value = detail.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
    if isinstance(detail, list):
        messages = [
            str(error["msg"])
            for error in detail
            if isinstance(error, dict) and isinstance(error.get("msg"), str)
        ]
        if messages:
            return " ; ".join(messages)

    return {
        400: "La requête est invalide.",
        401: "Authentification requise.",
        403: "Accès refusé.",
        404: "Ressource introuvable.",
        409: "La requête entre en conflit avec l’état actuel.",
        413: "Le contenu envoyé est trop volumineux.",
        415: "Le format envoyé n’est pas pris en charge.",
        422: "Les données envoyées ne sont pas valides.",
        429: "Trop de requêtes. Veuillez réessayer plus tard.",
    }.get(status_code, "La requête n’a pas pu être traitée.")


def error_payload(
    status_code: int,
    detail: Any = None,
) -> dict[str, Any]:
    response = ApiResponse(
        message=error_message(detail, status_code),
        has_error=True,
    ).model_dump(mode="json", by_alias=True, exclude_none=True)
    response["item"] = None
    return response
