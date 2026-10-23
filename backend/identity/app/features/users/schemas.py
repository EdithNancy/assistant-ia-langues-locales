import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from app.core.request_model import RequestModel


class UserRegister(RequestModel):
    full_name: str = Field(min_length=2, max_length=150)
    email: EmailStr
    phone_number: str = Field(min_length=7, max_length=32, pattern=r"^\+?[0-9][0-9\s().-]*$")
    password: str = Field(min_length=10, max_length=128)

    @field_validator("phone_number", mode="before")
    @classmethod
    def normalize_phone_number(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        normalized = "".join(character for character in value if character not in " ().-")
        if not 7 <= len(normalized.lstrip("+")) <= 15:
            raise ValueError("Le numéro doit contenir entre 7 et 15 chiffres.")
        return normalized

class UserUpdate(RequestModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=150)
    phone_number: str | None = Field(default=None, min_length=7, max_length=32,
                                     pattern=r"^\+?[0-9][0-9\s().-]*$")
    is_active: bool | None = None

    @field_validator("phone_number", mode="before")
    @classmethod
    def normalize_phone_number(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        normalized = "".join(character for character in value if character not in " ().-")
        if not 7 <= len(normalized.lstrip("+")) <= 15:
            raise ValueError("Le numéro doit contenir entre 7 et 15 chiffres.")
        return normalized

class UserResponse(BaseModel):
    id: uuid.UUID
    full_name: str
    email: EmailStr
    phone_number: str | None
    is_active: bool
    is_verified: bool
    roles: list[str]
    created_at: datetime

class UserAdminResponse(BaseModel):
    id: uuid.UUID
    full_name: str
    email: EmailStr
    phone_number: str | None
    is_active: bool
    is_verified: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
