from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

ChunkingProfileName = Literal["default", "small", "large"]
PrincipalType = Literal["group", "user"]
Role = Literal["viewer", "editor", "owner"]


class GrantIn(BaseModel):
    principal_type: PrincipalType
    principal_id: str = Field(min_length=1, max_length=200)
    role: Role


class GrantOut(GrantIn):
    pass


class GrantsUpdate(BaseModel):
    grants: list[GrantIn]


class CollectionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    embedding_model: str | None = None
    chunking_profile: ChunkingProfileName = "default"
    grants: list[GrantIn] = []


class CollectionPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    chunking_profile: ChunkingProfileName | None = None
    embedding_model: str | None = None


class CollectionOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    embedding_model: str
    chunking_profile: str
    created_by: str
    created_at: datetime
    role: str
    document_count: int = 0
    ready_count: int = 0
