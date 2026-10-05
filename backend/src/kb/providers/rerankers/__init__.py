from __future__ import annotations

from kb.config import Settings
from kb.providers.rerankers.base import Reranker
from kb.providers.rerankers.fake import OverlapReranker
from kb.providers.rerankers.remote import RemoteReranker


def build_reranker(settings: Settings) -> Reranker | None:
    if settings.reranker == "none":
        return None
    if settings.reranker == "fake":
        return OverlapReranker()
    return RemoteReranker(settings.models_url, settings.reranker_model, settings.models_timeout_seconds)


__all__ = ["OverlapReranker", "RemoteReranker", "Reranker", "build_reranker"]
