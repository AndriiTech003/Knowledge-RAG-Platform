from __future__ import annotations

from typing import Protocol


class Reranker(Protocol):
    name: str

    async def rerank(self, query: str, passages: list[str]) -> list[float]: ...
