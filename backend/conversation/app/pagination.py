from collections.abc import Mapping
from typing import Generic, Literal, TypeVar

from fastapi import HTTPException, Query, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import asc, desc
from sqlalchemy.sql import ColumnElement, Select

T = TypeVar("T")
COMMON_LIST_PARAMETERS = frozenset(
    {"offset", "limit", "search", "sort_by", "sort_order"}
)


class ListRequest(BaseModel):
    offset: int = Field(default=0, ge=0)
    limit: int = Field(default=50, ge=1, le=100)
    search: str | None = Field(default=None, min_length=1, max_length=200)
    sort_by: str | None = Field(default=None, min_length=1, max_length=50)
    sort_order: Literal["asc", "desc"] | None = None

    @field_validator("search", "sort_by", mode="before")
    @classmethod
    def strip_query_values(cls, value: object) -> object:
        return value.strip() or None if isinstance(value, str) else value


def validate_list_query(
    request: Request, *, allowed_filters: frozenset[str] = frozenset()
) -> None:
    unknown = (
        set(request.query_params.keys())
        - COMMON_LIST_PARAMETERS
        - allowed_filters
    )
    if unknown:
        names = ", ".join(sorted(unknown))
        raise HTTPException(
            status_code=422,
            detail=f"Paramètres de liste non pris en charge : {names}.",
        )


def get_list_request(
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    search: str | None = Query(default=None, min_length=1, max_length=200),
    sort_by: str | None = Query(default=None, min_length=1, max_length=50),
    sort_order: Literal["asc", "desc"] | None = Query(default=None),
) -> ListRequest:
    return ListRequest(
        offset=offset,
        limit=limit,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
    )


class PaginationInfo(BaseModel):
    offset: int
    limit: int
    total: int
    has_more: bool = Field(serialization_alias="hasMore")


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    pagination: PaginationInfo


def paginated_response(
    items: list[T], total: int, offset: int, limit: int
) -> PaginatedResponse[T]:
    return PaginatedResponse(
        items=items,
        pagination=PaginationInfo(
            offset=offset,
            limit=limit,
            total=total,
            has_more=offset + len(items) < total,
        ),
    )


def apply_sort(
    statement: Select,
    *,
    sort_by: str | None,
    sort_order: Literal["asc", "desc"] | None,
    columns: Mapping[str, ColumnElement],
    default: str,
    unique_column: ColumnElement,
    default_order: Literal["asc", "desc"] = "desc",
) -> Select:
    field = sort_by or default
    column = columns.get(field)
    if column is None:
        allowed = ", ".join(sorted(columns))
        raise HTTPException(
            status_code=422,
            detail=f"Tri non pris en charge. Champs disponibles : {allowed}.",
        )

    direction = sort_order or default_order
    order = asc if direction == "asc" else desc
    ordering = [order(column)]
    if column is not unique_column:
        ordering.append(order(unique_column))
    return statement.order_by(*ordering)
