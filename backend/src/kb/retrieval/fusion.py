from __future__ import annotations

import uuid
from collections.abc import Sequence
from typing import Protocol


class RankedHit(Protocol):
    chunk_id: uuid.UUID
    rank: int


def rrf(lists: Sequence[Sequence[RankedHit]], k: int = 60) -> list[tuple[uuid.UUID, float]]:
    scores: dict[uuid.UUID, float] = {}
    for hits in lists:
        for hit in hits:
            scores[hit.chunk_id] = scores.get(hit.chunk_id, 0.0) + 1.0 / (k + hit.rank)
    return sorted(scores.items(), key=lambda item: (-item[1], str(item[0])))
