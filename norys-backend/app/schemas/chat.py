"""Chat / conversation schemas."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.message import MessageRole
from app.schemas.common import ORMModel


class ConversationCreate(BaseModel):
    agent_id: uuid.UUID | None = None
    title: str | None = Field(default=None, max_length=255)


class ConversationOut(ORMModel):
    id: uuid.UUID
    title: str
    agent_id: uuid.UUID | None
    user_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class MessageOut(ORMModel):
    id: uuid.UUID
    role: MessageRole
    content: str
    tokens: int | None
    created_at: datetime


class ChatRequest(BaseModel):
    """Send a user message to a conversation and get the assistant reply."""

    content: str = Field(min_length=1)
    stream: bool = False


class ChatResponse(BaseModel):
    conversation_id: uuid.UUID
    message: MessageOut
