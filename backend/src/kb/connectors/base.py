from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Any, Protocol


@dataclass
class FetchedDocument:
    external_id: str
    title: str
    content: bytes
    mime_type: str
    filename: str
    etag: str | None = None
    last_modified: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class PageState:
    url: str
    etag: str | None
    last_modified: str | None
    last_status: int | None


@dataclass
class SyncPlan:
    upserts: list[FetchedDocument] = field(default_factory=list)
    unchanged: list[str] = field(default_factory=list)
    deletions: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    states: list[PageState] = field(default_factory=list)


class Connector(Protocol):
    kind: str

    async def fetch(
        self, source_id: uuid.UUID, config: dict[str, Any], state: dict[str, PageState]
    ) -> SyncPlan: ...
