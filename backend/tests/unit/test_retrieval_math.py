from __future__ import annotations

import uuid
from dataclasses import dataclass

from kb.evaluation.metrics import (
    RankedChunk,
    Relevant,
    leaked,
    ndcg_at_k,
    percentile,
    recall_at_k,
    reciprocal_rank,
)
from kb.retrieval.fusion import rrf
from kb.retrieval.lexical import or_query
from kb.retrieval.mmr import mmr_dedupe
from kb.retrieval.vector import index_name, vector_index_ddl, vector_literal


@dataclass
class Hit:
    chunk_id: uuid.UUID
    rank: int


def ids(n: int) -> list[uuid.UUID]:
    return [uuid.UUID(int=i + 1) for i in range(n)]


def test_rrf_rewards_items_present_in_both_lists() -> None:
    a, b, c = ids(3)
    fused = rrf([[Hit(a, 1), Hit(b, 2)], [Hit(c, 1), Hit(b, 2)]], k=60)
    assert fused[0][0] == b
    assert abs(fused[0][1] - 2 / 62) < 1e-12
    assert {x for x, _ in fused} == {a, b, c}


def test_rrf_is_deterministic_on_ties() -> None:
    a, b = ids(2)
    assert rrf([[Hit(b, 1)], [Hit(a, 1)]]) == rrf([[Hit(a, 1)], [Hit(b, 1)]])


@dataclass
class Item:
    doc: uuid.UUID
    text: str
    score: float


def test_mmr_caps_chunks_per_document_and_prefers_diversity() -> None:
    d1, d2 = ids(2)
    items = [Item(d1, f"per diem europe hotel cap {i}", 1.0 - i * 0.01) for i in range(5)]
    items.append(Item(d2, "parental leave weeks policy", 0.5))
    selected = mmr_dedupe(
        items, lambda x: x.score, lambda x: x.text, lambda x: x.doc, k=5, max_per_document=3
    )
    assert sum(1 for s in selected if s.doc == d1) == 3
    assert any(s.doc == d2 for s in selected)


def test_mmr_respects_k() -> None:
    items = [Item(uuid.uuid4(), f"text {i}", 1.0) for i in range(20)]
    assert len(mmr_dedupe(items, lambda x: x.score, lambda x: x.text, lambda x: x.doc, k=8)) == 8


def chunk(doc: uuid.UUID, page: int | None = None, coll: uuid.UUID | None = None) -> RankedChunk:
    return RankedChunk(doc, coll or uuid.UUID(int=99), page, page)


def test_recall_mrr_ndcg_with_pages() -> None:
    d1, d2, d3 = ids(3)
    ranked = [chunk(d3), chunk(d1, 2), chunk(d1, 4), chunk(d2)]
    relevant = [Relevant(d1, (4,)), Relevant(d2, None)]
    assert recall_at_k(ranked, relevant, 2) == 0.0
    assert recall_at_k(ranked, relevant, 4) == 1.0
    assert reciprocal_rank(ranked, relevant) == 1 / 3
    assert 0 < ndcg_at_k(ranked, relevant, 8) < 1
    assert ndcg_at_k([chunk(d1, 4), chunk(d2)], relevant, 8) == 1.0


def test_leakage_detects_foreign_collection() -> None:
    allowed, foreign = ids(2)
    assert not leaked([chunk(uuid.uuid4(), coll=allowed)], {allowed})
    assert leaked([chunk(uuid.uuid4(), coll=allowed), chunk(uuid.uuid4(), coll=foreign)], {allowed})


def test_percentile_interpolates() -> None:
    assert percentile([], 0.5) is None
    assert percentile([1, 2, 3, 4], 0.5) == 2.5
    assert percentile([10.0], 0.95) == 10.0


def test_or_query_drops_stopwords_and_keeps_codes() -> None:
    assert or_query("What is POL-SEC-014 about the MFA?") == "pol-sec-014 or mfa"
    assert or_query("the and of") == ""


def test_vector_index_ddl_is_partial_expression_index() -> None:
    ddl = vector_index_ddl("BAAI/bge-small-en-v1.5")
    assert "hnsw ((embedding::vector(384)) vector_cosine_ops)" in ddl
    assert "where embedding_model = 'BAAI/bge-small-en-v1.5'" in ddl
    assert index_name("BAAI/bge-small-en-v1.5") == "ix_chunks_emb_baai_bge_small_en_v1_5"
    assert vector_literal([0.5, 1.0]) == "[0.5,1]"
