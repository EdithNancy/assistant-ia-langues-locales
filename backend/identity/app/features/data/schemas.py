import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class LanguageCreate(BaseModel):
    code: str = Field(min_length=2, max_length=16)
    name: str = Field(min_length=1, max_length=100)
    native_name: str | None = Field(default=None, max_length=100)

    @field_validator("code", mode="before")
    @classmethod
    def normalize_code(cls, value: object) -> object:
        return value.strip().lower() if isinstance(value, str) else value

    @field_validator("name", "native_name")
    @classmethod
    def strip_names(cls, value: str | None) -> str | None:
        return value.strip() if value is not None else None


class LanguageOut(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    native_name: str | None
    is_active: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class VocabularyEntryCreate(BaseModel):
    source_language_id: uuid.UUID
    target_language_id: uuid.UUID
    source_text: str = Field(min_length=1, max_length=500)
    target_text: str = Field(min_length=1, max_length=1000)
    kind: Literal["word", "expression", "sentence"] = "word"
    pronunciation: str | None = Field(default=None, max_length=500)
    example_source: str | None = None
    example_target: str | None = None

    @field_validator("source_text", "target_text", "pronunciation", "example_source", "example_target")
    @classmethod
    def strip_text(cls, value: str | None) -> str | None:
        return value.strip() if value is not None else None

    @model_validator(mode="after")
    def validate_example_pair(self):
        if (self.example_source is None) != (self.example_target is None):
            raise ValueError("Les exemples source et cible doivent être fournis ensemble.")
        return self


class VocabularyEntryUpdate(BaseModel):
    source_language_id: uuid.UUID | None = None
    target_language_id: uuid.UUID | None = None
    source_text: str | None = Field(default=None, min_length=1, max_length=500)
    target_text: str | None = Field(default=None, min_length=1, max_length=1000)
    kind: Literal["word", "expression", "sentence"] | None = None
    pronunciation: str | None = Field(default=None, max_length=500)
    example_source: str | None = None
    example_target: str | None = None

    @field_validator("source_text", "target_text", "pronunciation", "example_source", "example_target")
    @classmethod
    def strip_text(cls, value: str | None) -> str | None:
        return value.strip() if value is not None else None


class VocabularyEntryOut(BaseModel):
    id: uuid.UUID
    source_language_id: uuid.UUID
    target_language_id: uuid.UUID
    source_text: str
    target_text: str
    kind: str
    pronunciation: str | None
    example_source: str | None
    example_target: str | None
    created_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
    source_language: LanguageOut
    target_language: LanguageOut
    model_config = ConfigDict(from_attributes=True)
