from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Literal, Protocol

from pydantic import BaseModel


class LlmMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class LlmUsage(BaseModel):
    input_tokens: int = 0
    output_tokens: int = 0


class LlmChunk(BaseModel):
    text: str | None = None
    usage: LlmUsage | None = None


class LlmResult(BaseModel):
    text: str
    usage: LlmUsage


class LlmUnavailableError(Exception):
    pass


class LlmClient(Protocol):
    model: str

    def stream(self, system: str, messages: list[LlmMessage], max_tokens: int) -> AsyncIterator[LlmChunk]: ...

    async def complete(self, system: str, messages: list[LlmMessage], max_tokens: int) -> LlmResult: ...


async def collect(stream: AsyncIterator[LlmChunk]) -> LlmResult:
    parts: list[str] = []
    usage = LlmUsage()
    async for chunk in stream:
        if chunk.text:
            parts.append(chunk.text)
        if chunk.usage:
            usage = chunk.usage
    return LlmResult(text="".join(parts), usage=usage)
