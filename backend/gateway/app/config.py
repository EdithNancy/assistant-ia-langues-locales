import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import dotenv_values


REQUIRED_CORS_ORIGINS = (
    "http://localhost:3000",
    "http://192.168.252.23:3000",
    "https://frontend-one-olive-vutn25pf1s.vercel.app",
)


_BACKEND_ENV_PATH = Path(__file__).resolve().parents[2] / ".env"
_IDENTITY_ENV_PATH = Path(__file__).resolve().parents[2] / "identity" / ".env"


def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, default)


def _dotenv_env(path: Path, name: str) -> str | None:
    value = dotenv_values(path).get(name)
    return value if isinstance(value, str) else None


def _jwt_env(name: str, *, legacy_name: str | None = None, default: str = "") -> str:
    if name in os.environ:
        return os.environ[name]
    for path in (_BACKEND_ENV_PATH, _IDENTITY_ENV_PATH):
        value = _dotenv_env(path, name)
        if value is not None:
            return value
    if legacy_name:
        return os.environ.get(legacy_name, default)
    return default


@dataclass(frozen=True)
class Route:
    upstream: str
    roles: frozenset[str] | None = None        # None = tout utilisateur authentifié
    public_paths: frozenset[str] = frozenset()  # chemins sans auth (ex: login)


@dataclass(frozen=True)
class Settings:
    jwt_algorithm: str = _jwt_env("JWT_ALGORITHM", default="HS256")
    jwt_key: str = _jwt_env("JWT_SECRET_KEY", legacy_name="JWT_KEY")
    jwt_audience: str | None = _jwt_env("JWT_AUDIENCE") or None
    redis_url: str | None = _env("REDIS_URL") or None
    rate_limit: int = int(_env("RATE_LIMIT", "120"))
    rate_window: int = int(_env("RATE_WINDOW", "60"))
    cors_origins: list[str] = field(
        default_factory=lambda: [
            *REQUIRED_CORS_ORIGINS,
            *(
                origin.strip()
                for origin in _env("CORS_ORIGINS", "").split(",")
                if origin.strip()
            ),
        ]
    )
    upstream_timeout: float = float(_env("UPSTREAM_TIMEOUT", "30"))

    def validate(self) -> None:
        if self.jwt_algorithm == "HS256" and len(self.jwt_key) < 32:
            raise ValueError("JWT_KEY must contain at least 32 characters for HS256.")
        if self.jwt_key.lower() in {"change-me", "changeme"} or self.jwt_key.startswith(
            ("REPLACE_WITH_", "CHANGE_ME")
        ):
            raise ValueError("Configure a private JWT_KEY before starting the gateway.")
        if self.rate_limit < 1 or self.rate_window < 1:
            raise ValueError("RATE_LIMIT and RATE_WINDOW must be positive integers.")
        if self.upstream_timeout <= 0:
            raise ValueError("UPSTREAM_TIMEOUT must be greater than zero.")
        if "*" in self.cors_origins:
            raise ValueError("CORS_ORIGINS cannot contain '*' when credentials are enabled.")

    @property
    def routes(self) -> dict[str, Route]:
        """Premier segment de /api/<service>/... -> service en aval."""
        identity = _env("IDENTITY_URL", "http://127.0.0.1:8001")
        return {
            "auth": Route(
                f"{identity}/api/v1/auth",
                public_paths=frozenset({"login", "register", "refresh", "social/nonce", "social/login"}),
            ),
            "users": Route(f"{identity}/api/v1/users"),
            "roles": Route(f"{identity}/api/v1/roles"),
            "permissions": Route(f"{identity}/api/v1/permissions"),
            "sessions": Route(f"{identity}/api/v1/sessions"),
            "usage": Route(f"{identity}/api/v1/usage"),
            "data": Route(f"{identity}/api/v1/data"),
            "conversations": Route(_env("CONVERSATION_URL", "http://127.0.0.1:8002")),
            "learning": Route(
                _env("LEARNING_URL", "http://learning:8003"),
                roles=frozenset({"pro", "admin", "super_admin"}),
            ),
        }

    @property
    def ws_routes(self) -> dict[str, str]:
        """/ws/<nom> -> URL WebSocket en aval."""
        conv = _env("CONVERSATION_URL", "http://127.0.0.1:8002")
        return {"conversation": conv.replace("http", "ws", 1) + "/ws"}


settings = Settings()
