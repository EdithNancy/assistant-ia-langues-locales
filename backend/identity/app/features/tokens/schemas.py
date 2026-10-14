import uuid
from datetime import datetime

from pydantic import BaseModel


class TokenBalanceResponse(BaseModel):
    user_id: uuid.UUID
    free_tokens_remaining: int
    purchased_tokens_remaining: int
    total_tokens: int
    has_tokens: bool
    next_free_refill_at: datetime
