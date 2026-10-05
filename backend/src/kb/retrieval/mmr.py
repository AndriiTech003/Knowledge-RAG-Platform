from __future__ import annotations

import uuid
from collections.abc import Callable

from kb.core.text import content_terms


def jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def mmr_dedupe[T](
    items: list[T],
    relevance: Callable[[T], float],
    text_of: Callable[[T], str],
    document_of: Callable[[T], uuid.UUID],
    k: int,
    max_per_document: int = 3,
    lambda_: float = 0.75,
) -> list[T]:
    remaining = list(items)
    term_sets = {id(item): set(content_terms(text_of(item))) for item in items}
    selected: list[T] = []
    per_doc: dict[uuid.UUID, int] = {}
    while remaining and len(selected) < k:
        best_index = -1
        best_score = float("-inf")
        for index, item in enumerate(remaining):
            if per_doc.get(document_of(item), 0) >= max_per_document:
                continue
            similarity = max((jaccard(term_sets[id(item)], term_sets[id(s)]) for s in selected), default=0.0)
            score = lambda_ * relevance(item) - (1 - lambda_) * similarity
            if score > best_score:
                best_score = score
                best_index = index
        if best_index < 0:
            break
        chosen = remaining.pop(best_index)
        per_doc[document_of(chosen)] = per_doc.get(document_of(chosen), 0) + 1
        selected.append(chosen)
    return selected
