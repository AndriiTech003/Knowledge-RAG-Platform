# ADR 0010: Provider abstractions with local models and fakes

Status: accepted · 2026-10-02

## Context

Tests and the demo must run without API keys; production should be able to switch providers by configuration.

## Decision

Protocols `Embedder`, `Reranker`, `LlmClient`, `Judge`. Implementations: models service (sentence-transformers bge-small-en-v1.5, MiniLM cross-encoder), hashing embedder and overlap reranker (tests), Anthropic and OpenAI-compatible LLM clients, deterministic `FakeLlm` that answers from the sources with citations.

## Alternatives considered

API-only providers (simple, but non-deterministic tests, cost in CI, data leaves the machine).

## Consequences

- Models run in their own process (`kb-models`), so the API and workers do not load torch.
- bge-small (384 dims) instead of a 1024-dim model: the machine has 8 GB RAM; the dimension is per collection, so a larger model is a configuration change plus reindex.
