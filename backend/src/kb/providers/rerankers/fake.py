from __future__ import annotations

import math

from kb.core.text import content_terms


class OverlapReranker:
    name = "overlap"

    async def rerank(self, query: str, passages: list[str]) -> list[float]:
        q_terms = set(content_terms(query))
        scores: list[float] = []
        for passage in passages:
            p_terms = content_terms(passage)
            if not q_terms or not p_terms:
                scores.append(0.0)
                continue
            present = set(p_terms)
            coverage = len(q_terms & present) / len(q_terms)
            density = sum(1 for t in p_terms if t in q_terms) / math.sqrt(len(p_terms))
            scores.append(round(min(1.0, 0.8 * coverage + 0.2 * min(1.0, density / 3)), 6))
        return scores
