from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class UploadUrlRequest(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    content_type: str | None = None
    size: int = Field(ge=1)


class UploadUrlResponse(BaseModel):
    upload_url: str
    storage_key: str
    expires_in: int
    method: str = "PUT"
    headers: dict[str, str] = {}


class DocumentRegister(BaseModel):
    storage_key: str = Field(min_length=1, max_length=1024)
    filename: str = Field(min_length=1, max_length=255)
    title: str | None = Field(default=None, max_length=500)


class DocumentOut(BaseModel):
    id: uuid.UUID
    collection_id: uuid.UUID
    source_id: uuid.UUID | None
    external_id: str | None
    title: str
    mime_type: str
    status: str
    error: str | None
    page_count: int | None
    metadata: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class IngestionJobOut(BaseModel):
    id: uuid.UUID
    kind: str
    status: str
    attempts: int
    error: str | None
    started_at: datetime | None
    finished_at: datetime | None
    stats: dict[str, Any] | None


class ChunkStats(BaseModel):
    chunks: int
    tokens: int
    embedded: int


class DocumentDetail(DocumentOut):
    chunk_stats: ChunkStats
    jobs: list[IngestionJobOut]
    role: str


class ChunkOut(BaseModel):
    id: uuid.UUID
    document_id: uuid.UUID
    ordinal: int
    text: str
    heading_path: list[str]
    page_start: int | None
    page_end: int | None
    char_start: int | None
    char_end: int | None
    token_count: int
    content_hash: str
    embedding_model: str | None


class ChunkDetail(ChunkOut):
    collection_id: uuid.UUID
    document_title: str
    mime_type: str


class DownloadUrl(BaseModel):
    url: str
    expires_in: int
    mime_type: str
    filename: str
