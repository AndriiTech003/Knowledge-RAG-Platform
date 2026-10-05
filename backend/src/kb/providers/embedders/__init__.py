from __future__ import annotations

from kb.config import Settings, embedding_dim
from kb.providers.embedders.base import Embedder
from kb.providers.embedders.hashing import HashingEmbedder
from kb.providers.embedders.remote import RemoteEmbedder


def build_embedder(settings: Settings, model: str | None = None) -> Embedder:
    name = model or settings.embedding_model
    if name.startswith("hash-") or settings.embedder == "hash":
        return HashingEmbedder(name if name.startswith("hash-") else "hash-384", embedding_dim("hash-384"))
    return RemoteEmbedder(settings.models_url, name, embedding_dim(name), settings.models_timeout_seconds)


__all__ = ["Embedder", "HashingEmbedder", "RemoteEmbedder", "build_embedder"]
