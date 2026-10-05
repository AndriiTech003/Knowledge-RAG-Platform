from __future__ import annotations

import re
import uuid
from datetime import datetime
from typing import Any, Literal

from croniter import croniter
from pydantic import BaseModel, Field, field_validator, model_validator


def _check_patterns(values: list[str]) -> list[str]:
    for value in values:
        try:
            re.compile(value)
        except re.error as exc:
            raise ValueError(f"invalid regex {value!r}: {exc}") from exc
    return values


class WebConfig(BaseModel):
    startUrl: str = Field(pattern=r"^https?://", max_length=2000)
    maxDepth: int = Field(default=2, ge=0, le=5)
    maxPages: int = Field(default=200, ge=1, le=5000)
    includePatterns: list[str] = []
    excludePatterns: list[str] = []
    respectRobots: bool = True

    @field_validator("includePatterns", "excludePatterns")
    @classmethod
    def valid_regex(cls, value: list[str]) -> list[str]:
        return _check_patterns(value)


class NotionConfig(BaseModel):
    databaseId: str | None = None
    query: str | None = None


class SourceCreate(BaseModel):
    kind: Literal["web", "notion"]
    config: dict[str, Any]
    schedule: str | None = Field(default=None, max_length=100)

    @model_validator(mode="after")
    def validate_config(self) -> SourceCreate:
        model = WebConfig if self.kind == "web" else NotionConfig
        self.config = model.model_validate(self.config).model_dump()
        if self.schedule and not croniter.is_valid(self.schedule):
            raise ValueError("schedule must be a valid cron expression")
        return self


class SourcePatch(BaseModel):
    config: dict[str, Any] | None = None
    schedule: str | None = Field(default=None, max_length=100)

    @field_validator("schedule")
    @classmethod
    def valid_cron(cls, value: str | None) -> str | None:
        if value and not croniter.is_valid(value):
            raise ValueError("schedule must be a valid cron expression")
        return value


class SourceOut(BaseModel):
    id: uuid.UUID
    collection_id: uuid.UUID
    kind: str
    config: dict[str, Any]
    schedule: str | None
    last_synced_at: datetime | None
    status: str | None
    last_error: str | None
    document_count: int = 0


class SyncJobOut(BaseModel):
    id: uuid.UUID
    status: str
    started_at: datetime | None
    finished_at: datetime | None
    stats: dict[str, Any] | None
    error: str | None
