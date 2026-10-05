import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class UsageEventResponse(BaseModel):
    id: uuid.UUID
    event_type: str
    user_id: uuid.UUID | None
    method: str
    route: str
    status_code: int
    duration_ms: int
    details: dict[str, str | int | float | bool | None]
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
