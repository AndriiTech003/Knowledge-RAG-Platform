from __future__ import annotations

from pydantic import BaseModel


class ChunkingProfile(BaseModel):
    name: str
    max_tokens: int
    overlap: bool = True
    contextual_prefix: bool = True


PROFILES: dict[str, ChunkingProfile] = {
    "default": ChunkingProfile(name="default", max_tokens=450),
    "small": ChunkingProfile(name="small", max_tokens=250),
    "large": ChunkingProfile(name="large", max_tokens=800),
}


def get_profile(name: str) -> ChunkingProfile:
    return PROFILES.get(name, PROFILES["default"])
