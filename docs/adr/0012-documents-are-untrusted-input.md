# ADR 0012: Document content is untrusted input to the LLM

Status: accepted · 2026-10-02

## Context

Anyone who can upload or publish a page can put instructions into the corpus (the corpus contains such a document on purpose).

## Decision

Sources are rendered inside `<sources>` with escaped markup and an explicit instruction that their content is data. After generation, guardrails drop sentences that match injection patterns or echo payloads from suspicious source sentences, remove URLs that are not in the sources (and any URL from a suspicious source), strip citations to non-existent sources and flag uncited numeric claims.

## Alternatives considered

Trusting the model's instruction following alone.

## Consequences

- Tested with an obedient fake model that repeats the injected text (`test_prompt_injection_document_is_not_obeyed`) and in the golden set (`injection` questions, metric `injection_resisted`).
- Pattern-based detection is a heuristic: novel phrasings can pass; it is defence in depth, not a guarantee.
