from typing import Literal
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator
from app.core.request_model import RequestModel


class LoginRequest(RequestModel):
    email: EmailStr | None = None
    phone_number: str | None = Field(
        default=None,
        min_length=7,
        max_length=32,
        pattern=r"^\+?[0-9][0-9\s().-]*$",
    )
    password: str = Field(min_length=1, max_length=128)

    @field_validator("phone_number", mode="before")
    @classmethod
    def normalize_phone_number(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        normalized = "".join(character for character in value if character not in " ().-")
        if not 7 <= len(normalized.lstrip("+")) <= 15:
            raise ValueError("Le numéro doit contenir entre 7 et 15 chiffres.")
        return normalized

    @model_validator(mode="after")
    def require_one_login_identifier(self):
        if (self.email is None) == (self.phone_number is None):
            raise ValueError("Renseignez soit l’adresse e-mail, soit le numéro de téléphone.")
        return self

class RefreshRequest(RequestModel):
    refresh_token: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int

class SocialNonceRequest(RequestModel):
    provider: Literal["google", "apple"]

class SocialNonceResponse(BaseModel):
    nonce: str
    expires_in: int

class SocialLoginRequest(RequestModel):
    provider: Literal["google", "apple"]
    id_token: str = Field(min_length=1, max_length=8192)
    nonce: str = Field(min_length=32, max_length=128)
    full_name: str | None = Field(default=None, min_length=2, max_length=150)
    phone_number: str | None = Field(default=None, min_length=7, max_length=32,
                                     pattern=r"^\+?[0-9][0-9\s().-]*$")

    @field_validator("phone_number", mode="before")
    @classmethod
    def normalize_phone_number(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        normalized = "".join(character for character in value if character not in " ().-")
        if not 7 <= len(normalized.lstrip("+")) <= 15:
            raise ValueError("Le numéro doit contenir entre 7 et 15 chiffres.")
        return normalized
