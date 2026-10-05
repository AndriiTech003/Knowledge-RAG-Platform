from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class ConversationCreate(BaseModel):
    title: str | None = Field(default=None, max_length=200)


class ConversationPatch(BaseModel):
    title: str = Field(min_length=1, max_length=200)


class ConversationOut(BaseModel):
    id: uuid.UUID
    title: str | None
    created_at: datetime
    updated_at: datetime


class MessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=4000)
    collections: list[uuid.UUID] | None = None


class MessageFeedback(BaseModel):
    rating: int
    reason: str | None
    comment: str | None


class MessageOut(BaseModel):
    id: uuid.UUID
    conversation_id: uuid.UUID
    role: Literal["user", "assistant"]
    content: str
    citations: list[dict[str, Any]] | None
    meta: dict[str, Any] | None
    status: str | None
    query_log_id: uuid.UUID | None
    created_at: datetime
    feedback: MessageFeedback | None = None


class FeedbackIn(BaseModel):
    rating: Literal[-1, 1]
    reason: Literal["wrong", "incomplete", "no_citation", "outdated", "other"] | None = None
    comment: str | None = Field(default=None, max_length=2000)


class FeedbackOut(BaseModel):
    id: uuid.UUID
    message_id: uuid.UUID
    rating: int
    reason: str | None
    comment: str | None
    created_at: datetime
