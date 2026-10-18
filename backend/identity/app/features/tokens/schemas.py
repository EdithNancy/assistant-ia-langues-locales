import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class TokenConsumptionRequest(BaseModel):
    credit_tokens: int = Field(
        ge=1,
        description="Crédits de conversation à débiter; ce nombre n'est pas le JWT Bearer.",
    )


class TokenBalanceResponse(BaseModel):
    user_id: uuid.UUID
    free_tokens_remaining: int = Field(description="Crédits de conversation gratuits restants.")
    purchased_tokens_remaining: int = Field(
        description="Crédits de conversation achetés restants."
    )
    total_tokens: int = Field(description="Solde total des crédits de conversation.")
    has_tokens: bool
    next_free_refill_at: datetime
