from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_ENV_PATH = Path(__file__).resolve().parents[2] / ".env"
_IDENTITY_ENV_PATH = Path(__file__).resolve().parents[1] / ".env"


class Settings(BaseSettings):
    APP_NAME: str = "IA Langues Locales CI"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"
    DATABASE_URL: str = "postgresql+psycopg://postgres:postgres@localhost:5432/ia_langues_locales"
    REDIS_URL: str = "redis://localhost:6379/0"
    RATE_LIMIT_AUTH: str = "5/minute"
    RATE_LIMIT_SOCIAL_NONCE: str = "10/minute"
    JWT_SECRET_KEY: str = Field(min_length=32)
    JWT_ALGORITHM: str = "HS256"
    JWT_AUDIENCE: str | None = None
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=15, ge=1)
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(default=30, ge=1)
    FREE_TOKEN_GRANT: int = Field(default=1000, ge=1)
    FREE_TOKEN_REFILL_DAYS: int = Field(default=1, ge=1)
    GOOGLE_CLIENT_IDS: str = ""
    APPLE_CLIENT_IDS: str = ""
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://192.168.252.23:3000",
        "https://frontend-one-olive-vutn25pf1s.vercel.app",
    ]
    model_config = SettingsConfigDict(
        env_file=(str(_IDENTITY_ENV_PATH), str(_BACKEND_ENV_PATH)),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @field_validator("JWT_SECRET_KEY")
    @classmethod
    def reject_placeholder_secret(cls, value: str) -> str:
        if value.startswith(("CHANGE_ME", "REPLACE_WITH_")):
            raise ValueError("Configure a private random JWT_SECRET_KEY before starting the API.")
        return value

    @field_validator("JWT_AUDIENCE", mode="before")
    @classmethod
    def normalize_jwt_audience(cls, value: object) -> object:
        return value or None

    def client_ids_for(self, provider: str) -> list[str]:
        value = self.GOOGLE_CLIENT_IDS if provider == "google" else self.APPLE_CLIENT_IDS
        return [client_id.strip() for client_id in value.split(",") if client_id.strip()]

@lru_cache
def get_settings():
    return Settings()

settings = get_settings()
