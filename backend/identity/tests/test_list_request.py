import unittest

from fastapi import HTTPException
from sqlalchemy import select
from pydantic import ValidationError
from starlette.requests import Request

from app.core.pagination import (
    ListRequest,
    apply_sort,
    validate_list_query,
)
from app.features.data.entity import Language


class ListRequestTests(unittest.TestCase):
    def test_normalizes_search_and_validates_pagination(self) -> None:
        request = ListRequest(
            offset=20,
            limit=10,
            search="  Dioula  ",
            sort_by="name",
            sort_order="asc",
        )

        self.assertEqual(request.search, "Dioula")
        self.assertEqual(request.offset, 20)
        with self.assertRaises(ValidationError):
            ListRequest(offset=-1)

    def test_rejects_unknown_sort_field(self) -> None:
        with self.assertRaises(HTTPException) as error:
            apply_sort(
                select(Language),
                sort_by="password",
                sort_order="asc",
                columns={"name": Language.name},
                default="name",
                unique_column=Language.id,
            )

        self.assertEqual(error.exception.status_code, 422)

    def test_rejects_unknown_query_parameter(self) -> None:
        request = Request(
            {
                "type": "http",
                "query_string": b"offset=0&unexpected_filter=true",
            }
        )

        with self.assertRaises(HTTPException) as error:
            validate_list_query(request)

        self.assertEqual(error.exception.status_code, 422)
        self.assertIn("unexpected_filter", error.exception.detail)

    def test_accepts_explicit_route_filter(self) -> None:
        request = Request(
            {"type": "http", "query_string": b"active_only=false"}
        )

        validate_list_query(
            request, allowed_filters=frozenset({"active_only"})
        )
