from __future__ import annotations

import math
import uuid
from dataclasses import dataclass
from statistics import mean


@dataclass(frozen=True)
class RankedChunk:
    document_id: uuid.UUID
    collection_id: uuid.UUID
    page_start: int | None
    page_end: int | None


@dataclass(frozen=True)
class Relevant:
    document_id: uuid.UUID
    pages: tuple[int, ...] | None


def matches(chunk: RankedChunk, item: Relevant) -> bool:
    if chunk.document_id != item.document_id:
        return False
    if not item.pages:
        return True
    if chunk.page_start is None:
        return True
    end = chunk.page_end if chunk.page_end is not None else chunk.page_start
    return any(chunk.page_start <= page <= end for page in item.pages)


def recall_at_k(ranked: list[RankedChunk], relevant: list[Relevant], k: int) -> float:
    if not relevant:
        return 0.0
    top = ranked[:k]
    found = sum(1 for item in relevant if any(matches(c, item) for c in top))
    return found / len(relevant)


def reciprocal_rank(ranked: list[RankedChunk], relevant: list[Relevant]) -> float:
    for index, chunk in enumerate(ranked, start=1):
        if any(matches(chunk, item) for item in relevant):
            return 1.0 / index
    return 0.0


def ndcg_at_k(ranked: list[RankedChunk], relevant: list[Relevant], k: int) -> float:
    if not relevant:
        return 0.0
    credited: set[int] = set()
    dcg = 0.0
    for position, chunk in enumerate(ranked[:k], start=1):
        for index, item in enumerate(relevant):
            if index not in credited and matches(chunk, item):
                credited.add(index)
                dcg += 1.0 / math.log2(position + 1)
                break
    ideal = sum(1.0 / math.log2(p + 1) for p in range(1, min(len(relevant), k) + 1))
    return dcg / ideal if ideal else 0.0


def leaked(chunks: list[RankedChunk], readable: set[uuid.UUID]) -> bool:
    return any(c.collection_id not in readable for c in chunks)


def percentile(values: list[float], q: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    position = (len(ordered) - 1) * q
    low = math.floor(position)
    high = math.ceil(position)
    if low == high:
        return round(ordered[low], 2)
    return round(ordered[low] + (ordered[high] - ordered[low]) * (position - low), 2)


def avg(values: list[float]) -> float | None:
    return round(mean(values), 4) if values else None
