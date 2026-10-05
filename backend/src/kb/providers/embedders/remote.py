from __future__ import annotations

import httpx


class RemoteEmbedder:
    def __init__(self, base_url: str, model: str, dim: int, timeout: float = 60.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.dim = dim
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

    async def _embed(self, texts: list[str], kind: str) -> list[list[float]]:
        if not texts:
            return []
        response = await self.client().post(
            f"{self.base_url}/embed", json={"model": self.model, "texts": texts, "kind": kind}
        )
        response.raise_for_status()
        data = response.json()
        embeddings: list[list[float]] = [[float(x) for x in row] for row in data["embeddings"]]
        for row in embeddings:
            if len(row) != self.dim:
                raise ValueError(f"embedding dimension {len(row)} does not match {self.dim}")
        return embeddings

    async def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return await self._embed(texts, "document")

    async def embed_query(self, text: str) -> list[float]:
        rows = await self._embed([text], "query")
        return rows[0]
