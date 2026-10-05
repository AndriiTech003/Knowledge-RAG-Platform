from __future__ import annotations

import re
from typing import Any

from kb.generation.prompts import section_of
from kb.retrieval.retriever import ScoredChunk

INLINE_CITATION_RE = re.compile(r"\[(\d+)\]")


def citation_payload(n: int, chunk: ScoredChunk) -> dict[str, Any]:
    return {
        "n": n,
        "chunk_id": str(chunk.chunk_id),
        "document_id": str(chunk.document_id),
        "collection_id": str(chunk.collection_id),
        "title": chunk.title,
        "section": section_of(chunk),
        "page": chunk.page_start,
        "page_end": chunk.page_end,
        "char_start": chunk.char_start,
        "char_end": chunk.char_end,
        "mime_type": chunk.mime_type,
        "score": round(chunk.relevance, 6),
        "snippet": chunk.text[:400],
    }


def source_summary(n: int, chunk: ScoredChunk) -> dict[str, Any]:
    return {
        "n": n,
        "title": chunk.title,
        "page": chunk.page_start,
        "section": section_of(chunk),
        "chunk_id": str(chunk.chunk_id),
        "document_id": str(chunk.document_id),
        "score": round(chunk.relevance, 6),
    }


class CitationTracker:
    def __init__(self, max_n: int) -> None:
        self.max_n = max_n
        self.seen: set[int] = set()
        self.buffer = ""

    def feed(self, token: str) -> list[int]:
        self.buffer = (self.buffer + token)[-64:]
        found: list[int] = []
        for match in INLINE_CITATION_RE.finditer(self.buffer):
            n = int(match.group(1))
            if 1 <= n <= self.max_n and n not in self.seen:
                self.seen.add(n)
                found.append(n)
        return found
