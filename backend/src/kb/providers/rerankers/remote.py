from __future__ import annotations

import math

import httpx


class RemoteReranker:
    def __init__(self, base_url: str, model: str, timeout: float = 60.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.name = model
        self.timeout = timeout
        self._client: httpx.AsyncClient | None = None

    def client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=self.timeout)
        return self._client

    async def aclose(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    async def rerank(self, query: str, passages: list[str]) -> list[float]:
        if not passages:
            return []
        response = await self.client().post(
            f"{self.base_url}/rerank", json={"model": self.name, "query": query, "passages": passages}
        )
        response.raise_for_status()
        data = response.json()
        return [1.0 / (1.0 + math.exp(-float(x))) for x in data["scores"]]
