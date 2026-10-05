from __future__ import annotations

import hashlib
import itertools
import math

from kb.core.text import content_terms


class HashingEmbedder:
    def __init__(self, model: str = "hash-384", dim: int = 384) -> None:
        self.model = model
        self.dim = dim

    def _vector(self, text: str) -> list[float]:
        terms = content_terms(text)
        features = list(terms)
        features.extend(f"{a}_{b}" for a, b in itertools.pairwise(terms))
        counts: dict[str, int] = {}
        for feature in features:
            counts[feature] = counts.get(feature, 0) + 1
        vec = [0.0] * self.dim
        for feature, count in counts.items():
            digest = hashlib.blake2b(feature.encode(), digest_size=8).digest()
            index = int.from_bytes(digest[:4], "little") % self.dim
            sign = 1.0 if digest[4] & 1 else -1.0
            weight = 1.0 + math.log(count)
            if "_" in feature:
                weight *= 0.5
            vec[index] += sign * weight
        norm = math.sqrt(sum(v * v for v in vec))
        if norm == 0:
            vec[0] = 1.0
            return vec
        return [v / norm for v in vec]

    async def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [self._vector(t) for t in texts]

    async def embed_query(self, text: str) -> list[float]:
        return self._vector(text)
