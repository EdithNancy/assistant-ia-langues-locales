import uuid
from pydantic import BaseModel, ConfigDict, Field

class PermissionCreate(BaseModel):
    code: str = Field(min_length=2, max_length=100, pattern=r"^[a-z][a-z0-9_.]*$")
    name: str = Field(min_length=2, max_length=150)
    description: str | None = None

class PermissionResponse(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    description: str | None
    model_config = ConfigDict(from_attributes=True)
