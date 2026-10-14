import unittest

from fastapi import FastAPI, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials
from fastapi.testclient import TestClient
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from app.core.dependencies import get_current_user
from app.main import app


def create_rate_limited_test_app() -> FastAPI:
    test_app = FastAPI()
    test_limiter = Limiter(
        key_func=get_remote_address,
        default_limits=["2/minute"],
        storage_uri="memory://",
    )
    test_app.state.limiter = test_limiter
    test_app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    test_app.add_middleware(SlowAPIMiddleware)

    @test_app.get("/health")
    def health(request: Request):
        return {"status": "ok"}

    return test_app


class SecurityOpenApiTests(unittest.TestCase):
    def test_openapi_documents_http_bearer_jwt(self) -> None:
        schemes = app.openapi()["components"]["securitySchemes"]

        self.assertEqual(
            schemes["HTTPBearer"],
            {"type": "http", "scheme": "bearer", "bearerFormat": "JWT"},
        )
        self.assertFalse(any(scheme.get("type") == "oauth2" for scheme in schemes.values()))

    def test_missing_credentials_remain_unauthorized(self) -> None:
        with self.assertRaises(HTTPException) as error:
            get_current_user(credentials=None, db=None)

        self.assertEqual(error.exception.status_code, 401)
        self.assertEqual(error.exception.headers["WWW-Authenticate"], "Bearer")

    def test_non_bearer_credentials_remain_unauthorized(self) -> None:
        credentials = HTTPAuthorizationCredentials(
            scheme="Basic",
            credentials="invalid",
        )

        with self.assertRaises(HTTPException) as error:
            get_current_user(credentials=credentials, db=None)

        self.assertEqual(error.exception.status_code, 401)

    def test_general_rate_limit_returns_429(self) -> None:
        with TestClient(create_rate_limited_test_app()) as client:
            responses = [client.get("/health") for _ in range(3)]

        self.assertTrue(all(response.status_code == 200 for response in responses[:2]))
        self.assertEqual(responses[-1].status_code, 429)


if __name__ == "__main__":
    unittest.main()
