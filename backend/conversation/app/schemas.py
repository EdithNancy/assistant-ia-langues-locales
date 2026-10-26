from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from .pagination import PaginatedResponse
from .request_model import RequestModel


class ConversationCreate(RequestModel):
    title: str = Field(default="Nouvelle conversation", max_length=200)


class MessageIn(RequestModel):
    content: str = Field(min_length=1, max_length=4000)


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    conversation_id: str
    role: str
    content: str
    original_content: str | None = None
    transcript: str | None = None
    reformulated_content: str | None = None
    understood_as: str | None = None
    modality: str = "text"
    status: str = "completed"
    input_tokens: int | None = None
    output_tokens: int | None = None
    estimated_usage: bool | None = None
    created_at: datetime


class VoiceMessageOut(BaseModel):
    conversation_id: str
    transcript: str
    reply: str
    user_message_id: int
    assistant_message_id: int
    reformulated_message: str | None = None
    understood_as: str | None = None
    audio_output_base64: str
    audio_output_media_type: str
    credit_tokens_charged: int
    model_token_usage_estimated: bool


class ChatTurnOut(BaseModel):
    """Tour complet conservant la forme historique de la réponse assistant."""
    model_config = ConfigDict(from_attributes=True)
    id: int
    conversation_id: str
    role: str
    content: str
    created_at: datetime
    user_message: MessageOut
    usage: dict


class ConversationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    title: str
    created_at: datetime


class ConversationDetail(ConversationOut):
    messages: PaginatedResponse[MessageOut]
