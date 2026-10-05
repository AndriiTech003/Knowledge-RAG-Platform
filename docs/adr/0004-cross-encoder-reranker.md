# ADR 0004: Cross-encoder reranking of the fused candidates

Status: accepted · 2026-10-02

## Context

RRF ranks are coarse, and the no-answer decision needs a relevance score with a meaningful absolute scale.

## Decision

Rerank the top-30 fused candidates with `cross-encoder/ms-marco-MiniLM-L-6-v2` (served by the `models` service), sigmoid the logits to 0–1, then apply MMR with max 3 chunks per document. The same score drives the no-answer threshold τ.

## Alternatives considered

No reranker (cheaper, lower MRR); LLM reranking (better quality, 10–50× the latency and cost per question).

## Consequences

- The rerank score has a stable scale, so τ was tuned on the eval set (unanswerable + permission questions) instead of guessed.
- Latency cost on an M1 CPU is the dominant retrieval step (hundreds of ms for 30 pairs); a GPU or a smaller candidate set reduces it. Recorded in the query trace waterfall and Grafana.
- Without the models service the API falls back to an overlap reranker (`KB_RERANKER=fake`) for tests.
