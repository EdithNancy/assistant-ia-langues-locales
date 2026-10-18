from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ConversationCreate(BaseModel):
    title: str = Field(default="Nouvelle conversation", max_length=200)


class MessageIn(BaseModel):
    content: str = Field(min_length=1, max_length=4000)


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    conversation_id: str
    role: str
    content: str
    created_at: datetime


class VoiceMessageOut(BaseModel):
    conversation_id: str
    transcript: str
    reply: str
    audio_output_base64: str
    audio_output_media_type: str
    credit_tokens_charged: int
    model_token_usage_estimated: bool


class ConversationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    title: str
    created_at: datetime


class ConversationDetail(ConversationOut):
    messages: list[MessageOut]
