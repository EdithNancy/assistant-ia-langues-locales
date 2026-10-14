import uuid
from pydantic import BaseModel, ConfigDict, Field

class RoleCreate(BaseModel):
    code: str = Field(min_length=2, max_length=50, pattern=r"^[A-Z][A-Z0-9_]*$")
    name: str = Field(min_length=2, max_length=100)
    description: str | None = None

class RoleResponse(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    description: str | None
    model_config = ConfigDict(from_attributes=True)
