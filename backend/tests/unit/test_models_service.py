from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient

from kb_models import app as models_app


class FakeEmbedModel:
    def encode(self, texts: list[str], **_: Any) -> list[list[float]]:
        return [[float(len(t)), 1.0] for t in texts]


class FakeCrossEncoder:
    def predict(self, pairs: list[tuple[str, str]], **_: Any) -> list[float]:
        return [float(len(p[1])) for p in pairs]


def test_embed_adds_query_instruction_and_rerank_scores(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("KB_MODELS_WARMUP", "0")
    monkeypatch.setattr(models_app.ModelRegistry, "embedder", lambda self, name: FakeEmbedModel())
    monkeypatch.setattr(models_app.ModelRegistry, "reranker", lambda self, name: FakeCrossEncoder())
    with TestClient(models_app.create_app()) as client:
        doc = client.post("/embed", json={"texts": ["abc"], "kind": "document"}).json()
        query = client.post("/embed", json={"texts": ["abc"], "kind": "query"}).json()
        assert doc["embeddings"][0][0] == 3.0
        assert query["embeddings"][0][0] > 3.0
        assert doc["dim"] == 2
        scores = client.post("/rerank", json={"query": "q", "passages": ["a", "abcd"]}).json()["scores"]
        assert scores == [1.0, 4.0]
        assert client.post("/rerank", json={"query": "q", "passages": []}).json()["scores"] == []
        assert client.get("/health").json()["status"] == "ok"


def test_unknown_models_are_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("KB_MODELS_WARMUP", "0")
    monkeypatch.delenv("KB_MODELS_ALLOW_ANY", raising=False)
    with TestClient(models_app.create_app()) as client:
        response = client.post("/embed", json={"model": "some/other-model", "texts": ["x"]})
        assert response.status_code == 400
