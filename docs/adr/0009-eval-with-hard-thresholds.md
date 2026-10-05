# ADR 0009: Evaluation harness with hard thresholds

Status: accepted · 2026-10-02

## Context

Retrieval and prompt changes silently regress quality; reviewing answers by hand does not scale.

## Decision

An 89-question golden set over a 60-document synthetic corpus (all question types, including permission, unanswerable, conflicting and prompt-injection). `kb-eval run` computes recall@5/8, MRR, nDCG@8, leakage rate, no-answer accuracy and (full mode) correctness, faithfulness, citation precision, injection resistance, latency and cost; `kb-eval gate` fails on recall@8 < 0.85, leakage ≠ 0 or a recall drop > 3 pp against a baseline report. Runs are stored in `eval_runs`/`eval_results` and shown in the admin UI with per-question comparison.

## Alternatives considered

Manual spot checks; LLM-judge only.

## Consequences

- The retrieval gate is deterministic and free (local models), the full mode uses a deterministic fake LLM + fake judge when no API key is configured, and a real judge (Anthropic or OpenAI-compatible) when one is.
- GitHub Actions / PR comments are intentionally not part of this repository (owner's rule: nothing git-related). The CLI produces the markdown table that such a comment would contain.
- The LLM judge is an approximation; its stability is measured by judging twice (agreement).
