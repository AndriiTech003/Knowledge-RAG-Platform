from __future__ import annotations

import asyncio
import os
import threading
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any, Literal

import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

QUERY_PREFIXES = {"BAAI/bge-small-en-v1.5": "Represent this sentence for searching relevant passages: "}
DEFAULT_EMBEDDER = os.environ.get("KB_MODELS_EMBEDDER", "BAAI/bge-small-en-v1.5")
DEFAULT_RERANKER = os.environ.get("KB_MODELS_RERANKER", "cross-encoder/ms-marco-MiniLM-L-6-v2")


class EmbedRequest(BaseModel):
    model: str = DEFAULT_EMBEDDER
    texts: list[str] = Field(max_length=256)
    kind: Literal["query", "document"] = "document"


class EmbedResponse(BaseModel):
    model: str
    dim: int
    embeddings: list[list[float]]


class RerankRequest(BaseModel):
    model: str = DEFAULT_RERANKER
    query: str
    passages: list[str] = Field(max_length=200)


class RerankResponse(BaseModel):
    model: str
    scores: list[float]


class ModelRegistry:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.embedders: dict[str, Any] = {}
        self.rerankers: dict[str, Any] = {}

    def embedder(self, name: str) -> Any:
        with self.lock:
            if name not in self.embedders:
                if name != DEFAULT_EMBEDDER and os.environ.get("KB_MODELS_ALLOW_ANY") != "1":
                    raise HTTPException(400, f"model {name} is not served")
                from sentence_transformers import SentenceTransformer

                self.embedders[name] = SentenceTransformer(name, device="cpu")
            return self.embedders[name]

    def reranker(self, name: str) -> Any:
        with self.lock:
            if name not in self.rerankers:
                if name != DEFAULT_RERANKER and os.environ.get("KB_MODELS_ALLOW_ANY") != "1":
                    raise HTTPException(400, f"model {name} is not served")
                from sentence_transformers import CrossEncoder

                self.rerankers[name] = CrossEncoder(name, device="cpu", max_length=512)
            return self.rerankers[name]


def create_app() -> FastAPI:
    registry = ModelRegistry()

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
        if os.environ.get("KB_MODELS_WARMUP", "1") == "1":
            await asyncio.to_thread(registry.embedder, DEFAULT_EMBEDDER)
            await asyncio.to_thread(registry.reranker, DEFAULT_RERANKER)
        yield

    app = FastAPI(title="kb-models", version="0.1.0", lifespan=lifespan)
    embed_slots = asyncio.Semaphore(int(os.environ.get("KB_MODELS_EMBED_CONCURRENCY", "2")))
    rerank_slots = asyncio.Semaphore(int(os.environ.get("KB_MODELS_RERANK_CONCURRENCY", "2")))

    @app.get("/health")
    async def health() -> dict[str, Any]:
        return {
            "status": "ok",
            "embedders": sorted(registry.embedders),
            "rerankers": sorted(registry.rerankers),
        }

    @app.post("/embed", response_model=EmbedResponse)
    async def embed(body: EmbedRequest) -> EmbedResponse:
        model = registry.embedder(body.model)
        prefix = QUERY_PREFIXES.get(body.model, "") if body.kind == "query" else ""
        texts = [prefix + t for t in body.texts]
        async with embed_slots:
            vectors = await asyncio.to_thread(
                model.encode, texts, batch_size=32, normalize_embeddings=True, convert_to_numpy=True
            )
        rows = [[round(float(x), 6) for x in row] for row in vectors]
        return EmbedResponse(model=body.model, dim=len(rows[0]) if rows else 0, embeddings=rows)

    @app.post("/rerank", response_model=RerankResponse)
    async def rerank(body: RerankRequest) -> RerankResponse:
        if not body.passages:
            return RerankResponse(model=body.model, scores=[])
        model = registry.reranker(body.model)
        pairs = [(body.query, p) for p in body.passages]
        async with rerank_slots:
            scores = await asyncio.to_thread(model.predict, pairs, batch_size=32, show_progress_bar=False)
        return RerankResponse(model=body.model, scores=[round(float(s), 6) for s in scores])

    return app


app = create_app()


def main() -> None:
    uvicorn.run(
        app,
        host=os.environ.get("KB_MODELS_HOST", "127.0.0.1"),
        port=int(os.environ.get("KB_MODELS_PORT", "4410")),
    )


if __name__ == "__main__":
    main()
