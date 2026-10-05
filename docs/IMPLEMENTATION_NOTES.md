# Implementation notes

Built against `README.md` and `docs/ARCHITECTURE.md`, `docs/DATA_MODEL_AND_API.md`, `docs/RAG_PIPELINE.md`, `docs/FRONTEND_ANGULAR.md`, `docs/ROADMAP.md` (M0 → M6), following `devinfra/CONVENTIONS.md`.
Verification date: 2026-10-02; gap-closing pass (i18n, Storybook, Lighthouse, real MCP client, corpus fix, `KB_FUSED_TOP_K` decision) re-verified end to end on 2026-10-05. Machine: Apple M1, 8 GB RAM, macOS (Darwin 27), no Docker. Python 3.13.14 (uv 0.11.32), Node 26.7.0 / npm 11.19, PostgreSQL 16.14 + pgvector 0.8.6, Redis 8, MinIO from devinfra, Keycloak 26.8.0 (official distribution + Homebrew OpenJDK 21). Other projects were running on the same machine during the measurements.

## Layout

| Path | What |
|---|---|
| `backend/src/kb` | FastAPI app: `core` (settings, db, problem+json, cursor pagination, JWKS verifier, storage, events, telemetry), `auth`, `access` (ACL + Redis cache), `collections`, `documents` (+ SSE events), `connectors` (upload, web crawler, Notion, sync service), `ingestion` (parsers, structural chunker, hashing, pipeline), `retrieval` (vector, lexical, RRF, MMR, retriever), `generation` (versioned prompts, answer engine, citations, guardrails), `chat`, `feedback`, `analytics`, `evaluation` (dataset, metrics, judges, runner, CLI, corpus builder), `providers` (embedders, rerankers, LLMs incl. fakes), `workers` (Celery app, tasks, runtime), `mcp` (MCP server) |
| `backend/src/kb_models` | `models` service: FastAPI over sentence-transformers (`/embed`, `/rerank`) |
| `backend/alembic` | migration `0001` with the full schema, extensions and HNSW indexes |
| `backend/tests` | `unit` (77), `integration` (43), `eval` (3), parser fixtures in `tests/fixtures` |
| `backend/scripts` | `check_no_comments.py` (lint rule for the no-comments convention), `export_openapi.py`, `smoke_checks.py` |
| `backend/loadtest/locustfile.py` | Locust scenario |
| `frontend/` | Angular 22 SPA (standalone, zoneless, signals, SignalStore, Material 3), generated OpenAPI client, i18n catalogs `src/locale/messages.json` (en, extracted) and `messages.uk.json`, Storybook (`.storybook/`, `src/app/shared/ui/*.stories.ts`), Vitest unit tests, Playwright e2e (`frontend/e2e`), scripts `check-i18n.mjs`, `verify-i18n-catalog.mjs`, `storybook-test.mjs`, `lighthouse.mjs`, `serve.mjs` |
| `eval-data/` | `corpus-src/` (61 Markdown sources with target format), `corpus/` (built PDF/DOCX/MD/HTML), `golden.jsonl` (91 questions), `collections.json`, `users.json` |
| `infra/` | `docker-compose.yml`, `keycloak/realm-northwind.json`, `prometheus/`, `grafana/` (provisioning + dashboard), `web/` (nginx image) |
| `scripts/` | `keycloak.sh` (start/stop/status/token), `stack.sh` (shared start/stop helpers), `smoke.sh`, `e2e.sh`, `loadtest.sh`, `lighthouse.sh` (fresh stack + authenticated Lighthouse), `eval-sweep.sh` (fresh stack, `KB_FUSED_TOP_K` sweep, default eval + gate) |
| `docs/adr/` | 12 ADRs, `docs/eval/` experiment table + eval reports (`docs/eval/fused-k/` for the fused-candidate sweep), `docs/benchmarks/` Locust results, `docs/lighthouse/` Lighthouse reports (HTML per page, `summary.md`, `summary.json`) |

## How to run

```sh
/Users/asnh/Desktop/projects_for_git/devinfra/start.sh      # Postgres, Redis, MinIO
cd backend && uv sync && cd ..                                # API, workers, models deps (torch is in the default "models" group)
cd frontend && npm ci && cd ..
scripts/keycloak.sh start                                     # Keycloak 26.8 on 127.0.0.1:4480, realm northwind imported fresh
cd backend && uv run kb-models &                              # models service :4410 (bge-small + MiniLM, CPU)
uv run kb-seed                                                # creates db "kb", migrates, indexes the 61-document corpus (≈30 s)
uv run kb-api &                                               # API :4400 (OpenAPI at /api/v1/docs)
uv run celery -A kb.workers.celery_app worker -Q ingest,embed,sync,eval,maintenance -c 2 &
uv run celery -A kb.workers.celery_app beat &
cd ../frontend && npm start                                   # http://127.0.0.1:4420, log in as alice / demo
```

Language: the translate button in the top bar switches between English and Українська; the choice is stored in `localStorage` (`kb.locale`), applied before bootstrap on the next load (default: browser language, else English) and also sent to Keycloak as `ui_locales`, so the login page follows it. Storybook: `npm run storybook` (http://127.0.0.1:4440), `npm run storybook:build && npm run storybook:test`. MCP: `KB_MCP_TOKEN=$(scripts/keycloak.sh token alice) uv run kb-mcp` (stdio) or `uv run kb-mcp --transport streamable-http --port 4430` (each client sends its own `Authorization: Bearer <access token>`).

Users (password `demo`): `alice` (engineering), `bob` (sales), `carol` (finance), `admin` (kb-admins). Redis db 4 with key prefix `KB_REDIS_PREFIX` (default `kb`), MinIO bucket `kb`, Postgres db `kb`; every test/smoke/e2e/load run uses its own `kb_test_*` database, `kb-test-*` bucket and Redis prefix and removes them afterwards. Ports: API 4400, models 4410, Angular dev 4420, built app 4421, MCP (http mode) 4430, Storybook dev 4440 and static test server 4441, Lighthouse stack 4442–4444, eval-sweep stack 4446–4448, e2e stack 4450–4452, smoke stack 4460–4462, load stack 4470–4472, Keycloak 4480 (+ management 4481), Prometheus/Grafana in compose 4490/4491.

`make` targets mirror everything: `install, keycloak, models, api, worker, beat, web, seed, lint` (incl. `npm run i18n:verify`)`, typecheck, test, test-unit, test-integration, eval, eval-full, eval-gate, eval-sweep, experiments, smoke, e2e, loadtest, lighthouse, storybook, storybook-test, i18n-extract, mcp, corpus, openapi, api-client, up, down`.

## What was verified (commands actually run, all passing)

Re-run on 2026-10-05 after the gap-closing changes (61 documents, 91 golden questions):

| Step | Command | Result |
|---|---|---|
| Clean install | `uv sync`; `rm -rf frontend/node_modules && npm ci` | ok (1619 packages) |
| No comments (Python) | `uv run python scripts/check_no_comments.py` | 148 files, 0 problems (comments and docstrings) |
| No comments (TS/HTML/SCSS) + untranslated text | `npm run lint` (ESLint local `no-comments` rule, template/style comment check, `check-i18n.mjs`) | 0 problems, 0 untranslated strings |
| i18n catalogs | `npm run i18n:verify` (re-extracts into a temp dir and compares) | 539 messages, committed `messages.json` up to date, `messages.uk.json` complete with matching placeholders |
| Ruff | `ruff check src tests scripts alembic loadtest`, `ruff format --check …` | all checks passed, 152 files formatted |
| mypy | `uv run mypy` (strict; src, tests, scripts) + `mypy --strict loadtest/locustfile.py` | 146 + 1 files, no issues |
| Backend tests | `uv run pytest` | **123 passed** (77 unit, 43 integration, 3 eval) in 59 s |
| Frontend build | `npm run build` | ok; initial bundle **393.64 kB** raw / 112.19 kB transfer (budget: error 400 kB, warning 350 kB — prints the warning, as before) |
| Frontend unit | `npm test` (Vitest via `@angular/build:unit-test`) | **20 files, 132 tests passed** |
| Storybook | `npm run storybook:build` + `npm run storybook:test` (official `@storybook/test-runner` against the static build) | build ok; **6 suites, 19 story tests passed** (render + play functions) |
| E2E | `scripts/e2e.sh` (fresh stack: real Keycloak, models, API, worker, beat, built app) | **5 passed** (upload → ready → cited answer → PDF opens at page 2; bob vs carol; admin starts two eval runs and compares; non-admin redirected; language switch to Ukrainian, persisted across reload, back to English) |
| Smoke | `scripts/smoke.sh` | **39 checks passed**, exit 0, every started process stopped, database/bucket/keys removed |
| Eval gate | `FUSED_K_SIZES= scripts/eval-sweep.sh` (fresh db, default config, `kb-eval run` + `kb-eval gate`) | recall@8 0.993, leakage 0 → passed |
| `KB_FUSED_TOP_K` sweep | `scripts/eval-sweep.sh` | 12 / 20 / 30 / 50 candidates, table in "Evaluation results" |
| Lighthouse | `scripts/lighthouse.sh` (fresh stack, built app, logged in through Keycloak) | scores in "Deviations" item 21, reports in `docs/lighthouse/` |
| MCP with a real client | `pytest tests/integration/test_mcp_client.py` | 3 passed (official SDK `Client` over stdio as carol and as bob; Streamable HTTP as carol and bob, 401 without token, forged token rejected) |

Earlier measurements that were not repeated in this pass (they do not depend on the changes): full eval with the fake LLM/judge, the experiment table and the Locust runs below (2026-10-02, 89 questions, 60 documents).

Required scenarios and where they are tested:

| Requirement | Test |
|---|---|
| user × collection × action matrix | `tests/integration/test_acl_matrix.py` (6 users × 4 collections × 5 actions incl. list visibility, roles, 404 vs 403, problem+json) |
| Leakage (unit + integration + eval) | `tests/unit/test_retrieval_math.py::test_leakage…`, `tests/integration/test_leakage.py` (all search modes × rerank on/off × 5 users, chunk/document/download endpoints, chat sources, requested collections cannot widen access), eval oracle `leakage_rate == 0` (`tests/eval`, `kb-eval gate`) |
| Pre-filter + iterative HNSW scan | `test_prefilter_with_iterative_hnsw_scan…` (2000 chunks, 5 in the allowed collection, `ef_search=10`), `test_vector_query_uses_partial_hnsw_index` |
| Parsers on fixtures incl. "hard" PDF | `tests/unit/test_parsers.py` (running header/footer removed, heading levels from font size, table → markdown on page 2, scanned PDF → `no_text_layer`, DOCX headings/lists/tables, Markdown AST, HTML without nav/footer, TXT, MIME by content, executables rejected) |
| Chunker properties | `tests/unit/test_chunker.py` (Hypothesis: no chunk > max_tokens, no text lost, deterministic ordinals/hashes; plus heading/overlap/table/prefix cases) |
| Incremental indexing | `tests/integration/test_ingestion.py` (one changed section → 1 new, rest unchanged, 1 deleted; unchanged doc skipped; forced reindex reuses all embeddings) |
| Worker killed during ingest | `tests/integration/test_chaos_worker.py` (SIGKILL pool process → task requeued; SIGKILL whole worker → redelivered after visibility timeout; both end `ready` without duplicate chunks) |
| Prompt-injection document | `tests/integration/test_chat_api.py::test_prompt_injection_document_is_not_obeyed` (default fake + an "obedient" fake that repeats the injection), golden `injection` questions (`injection_resisted = 1.0`), smoke |
| SSE contract, stop, disconnect | `tests/integration/test_chat_api.py` (event order, persistence, query_log, stop endpoint and client disconnect against a live uvicorn) |
| Graceful degradation | `tests/integration/test_degradation.py` (slow reranker → RRF order + `rerank_unavailable`; embedding outage → lexical) |
| Web connector / Notion | `tests/unit/test_connectors.py` (robots, depth, include/exclude, sitemap, ETag/Last-Modified, 404 → deletion, canonical URL, rate limit; Notion mocked with respx), `tests/integration/test_sources_api.py` |
| JWT/JWKS | `tests/unit/test_security.py` (expiry, audience, issuer, unknown key, HS256 confusion, rotation refresh) |
| Telemetry | `tests/integration/test_telemetry.py` (OTel span `rag.retrieve` attributes, Prometheus metrics) |
| MCP | `tests/unit/test_mcp.py` (token forwarding, bearer parsing, error mapping) and `tests/integration/test_mcp_client.py` (official MCP SDK client against the real server process and a live API: `list_tools`, `search_knowledge`, `get_document` as two users over stdio and Streamable HTTP; carol sees the Q3 budget, bob gets no finance hits and "not accessible" for the finance document) |
| i18n | `src/app/core/i18n/i18n-catalog.spec.ts` (same ids in en and uk, non-empty, same placeholders, Ukrainian one/few/many/other in every ICU plural, < 5% identical strings), `language.spec.ts` (locale resolution, persistence + reload, catalog loaded before bootstrap, templates render in Ukrainian, fallback to English), `npm run i18n:verify`, `check-i18n.mjs`, e2e `i18n.e2e.ts` |
| Shared UI components | Storybook stories with play functions for citation-chip, empty-state, status-badge, confirm-dialog, file-drop-zone, skeleton, run by `npm run storybook:test` |

## Evaluation results (real numbers)

Current dataset `golden-91q-dae72572a6`: the 89 questions below plus two about the new Procurement Policy (`q090` exact_term for alice, `q091` factoid for bob); corpus 61 documents (13 DOCX), 588 chunks. Default configuration after this pass (hybrid + rerank, `KB_FUSED_TOP_K=20`, fresh database, `docs/eval/fused-k/eval-default.json`): recall@5 97.1%, **recall@8 99.3%**, MRR 0.968, nDCG@8 0.962, **leakage 0**, no-answer accuracy 94.5%, p50 / p95 retrieval 350 / 669 ms; per type recall@8 is 100% except multi_hop (92.9%).

### `KB_FUSED_TOP_K` (number of RRF candidates sent to the cross-encoder)

`scripts/eval-sweep.sh` builds one fresh index and runs the retrieval eval for each size (`docs/eval/fused-k/sweep.md`, JSON per size next to it):

| KB_FUSED_TOP_K | Recall@5 | Recall@8 | MRR | nDCG@8 | No-answer acc. | Leakage | p50 retrieval | p95 retrieval |
|---|---|---|---|---|---|---|---|---|
| 12 | 98.6% | 98.6% | 0.972 | 0.962 | 94.5% | 0 | 156 ms | 365 ms |
| 20 | 97.8% | 100.0% | 0.968 | 0.966 | 94.5% | 0 | 298 ms | 611 ms |
| 30 | 97.8% | 99.3% | 0.968 | 0.962 | 93.4% | 0 | 557 ms | 1013 ms |
| 50 | 97.1% | 98.6% | 0.968 | 0.958 | 93.4% | 0 | 751 ms | 1619 ms |

Decision: the default is now **20** (`Settings.fused_top_k`, `RetrievalConfig.fused_k`, `kb-eval run --fused-k` defaults to the setting). 20 is at least as good as the specified 30 on every quality metric (recall@8 100% vs 99.3%, nDCG@8 0.966 vs 0.962, no-answer accuracy 94.5% vs 93.4%) at 40% lower p95 retrieval latency; 50 is worse and slower; 12 is the fastest but missed one more relevant page at recall@8. Differences between 12, 20 and 30 are one or two questions, which is within run-to-run noise: a second fresh index with 20 gave recall@8 99.3% (the gate run above), because the HNSW graph is rebuilt randomly on every seed. Latency therefore decides between configurations of equal quality; under heavy concurrent load on CPU `KB_FUSED_TOP_K=12` remains the throughput setting (Locust run C below).

### Baseline from 2026-10-02 (89 questions, 60 documents)

Golden set `golden-89q-555586b529`: 89 questions — factoid 26, table 12, exact_term 11, multi_hop 7, follow_up 6, conflicting 3, injection 2, permission 12, unanswerable 10; users alice 32, bob 26, carol 22, admin 9. Corpus: 60 documents (20 PDF, 12 DOCX, 15 MD, 13 HTML across 7 collections; finance and HR restricted; one prompt-injection page), 578 chunks with the default profile.

Default configuration (hybrid + rerank, fresh database, `docs/eval/eval-retrieval.json`, `eval-full.json`):

| Metric | Value |
|---|---|
| Recall@5 / Recall@8 | 97.0% / **98.5%** (gate ≥ 85%) |
| MRR / nDCG@8 | 0.967 / 0.957 |
| Leakage rate | **0** (0 of 89 queries; independent oracle) |
| No-answer accuracy | 93.3% (τ = 0.10) |
| Correctness (fake judge, 1–5) | 3.60 |
| Faithfulness (fake judge) | 0.995 |
| Citation precision | 0.68 (the fake LLM cites up to three sources, some from neighbouring documents) |
| Injection resisted | 1.0 |
| Judge agreement (two passes) | 1.0 (deterministic fake judge) |
| p50 / p95 latency, first token p95 | 1.20 s / 2.29 s, 2.31 s (CPU reranker) |
| Cost per question | $0.000655 (fake model priced at $0.5/$1.5 per MTok to exercise the accounting) |

Per type: recall@8 is 100% for every type except multi_hop (85.7%: one of two documents missed in one question); no-answer accuracy is lowest for unanswerable (70%: e.g. "What does error code NW-E9999 mean?" retrieves the error catalogue with a high rerank score) and permission (91.7%).

No-answer threshold sweep (`kb-eval tune-threshold`, `docs/eval/threshold-sweep.md`): accuracy plateaus at 93.3% for τ ∈ [0.08, 0.52]; τ = 0.10 was chosen (1 false refusal, 5 missed refusals). Without a reranker a vector-similarity threshold of 0.6 is used (≈80% no-answer accuracy).

Experiment table (`docs/eval/experiments-table.md`, each row a separately built index, fake LLM/judge for the answer columns):

| Configuration | Recall@5 | Recall@8 | MRR | nDCG@8 | exact_term R@8 | No-answer acc. | Faithfulness | Correctness | p95 retrieval | p95 answer |
|---|---|---|---|---|---|---|---|---|---|---|
| Vector only, chunk 800 | 91.8% | 94.8% | 0.867 | 0.873 | 100.0% | 80.9% | 99.5% | 3.40 | 58 ms | 55 ms |
| Vector only, chunk 450 | 91.8% | 94.8% | 0.859 | 0.870 | 100.0% | 80.9% | 99.5% | 3.40 | 122 ms | 75 ms |
| + contextual prefix | 95.5% | 95.5% | 0.945 | 0.934 | 100.0% | 79.8% | 100.0% | 3.58 | 85 ms | 69 ms |
| + lexical (hybrid RRF) | 98.5% | 98.5% | 0.943 | 0.942 | 100.0% | 79.8% | 99.5% | 3.45 | 83 ms | 57 ms |
| + reranker | 97.0% | 98.5% | 0.967 | 0.957 | 100.0% | 93.3% | 99.5% | 3.60 | 2673 ms* | 1965 ms* |

\* measured while the frontend was being built on the same CPU; a quiet single-user run gives p95 2.9 s (30 candidates) and 1.05 s (12 candidates). Reranking the top 12 instead of 30 measured recall@8 99.3%, MRR 0.969, no-answer accuracy 94.4% (`docs/eval/eval-retrieval-k12.json`). This table was measured with 30 fused candidates; the default is now 20 (see the sweep above).

## Performance (Locust, `docs/benchmarks/`)

50 users, 90 s, FakeLlm at 15 ms/token, one uvicorn process, everything on the laptop.

| Run | Change | Requests | Failures | First token p50 / p95 | Search p50 / p95 | req/s |
|---|---|---|---|---|---|---|
| A | baseline (shared inference queue, 30 rerank candidates) | 222 | 0 | 38 s / 52 s | 39 s / 53 s | 2.5 |
| B | separate embed / rerank queues in the models service | 175 | 29 | 27 s / 49 s | 35 s / 60 s | 2.0 |
| C | + 12 rerank candidates | 437 | 0 | 17 s / 22 s | 17 s / 21 s | 4.9 |
| D | + 8 s rerank deadline with fallback to RRF order | 724 | 0 | 8.9 s / 10 s | 8.4 s / 9.7 s | 8.1 |

Mean step time A → D: embed 12.8 s → 87 ms (it had been waiting behind reranks), vector 14 → 188 ms, lexical 31 → 169 ms, rerank 22.4 s → 7.6 s. The database (pool 10+10, `ef_search` 100) was never the bottleneck at this load; the CPU cross-encoder is. Changes made because of the load test: separate concurrency limits for embeddings and reranking in the models service, and deadlines with graceful degradation (`degraded: ["rerank_unavailable" | "embedding_unavailable"]` in search, chat meta and warnings) instead of 500s (run B's failures were 60 s client timeouts to the models service).

## Deviations from the spec and decisions taken

1. **No git, no CI (owner's rule).** Nothing git-related exists in the project: no `.github/` workflows, no PR-comment workflow, no pre-commit hooks, no git commands in any script. The spec's "CI gate with PR comment" and nightly workflow are therefore intentionally skipped; the same gate is available locally as `kb-eval gate` (recall@8 ≥ 0.85, leakage = 0, drop vs a baseline report ≤ 3 pp) and `kb-eval run --markdown` writes the markdown table such a comment would contain (with Δ vs a baseline report). `eval_runs.git_sha` holds a content hash of the backend source tree (`src-<sha256[:12]>`) instead of a commit SHA.
2. **Embedding model and dimension.** `BAAI/bge-small-en-v1.5` (384 dims) and `cross-encoder/ms-marco-MiniLM-L-6-v2` instead of a 1024-dim model (8 GB machine). `chunks.embedding` is an untyped `vector` column; each embedding model gets a partial expression HNSW index `((embedding::vector(dim)) vector_cosine_ops) where embedding_model = '…'` created by the migration and on collection create, so the dimension is per collection (`collections.embedding_model`). Same for `query_logs.question_embedding`. A hashing embedder (`hash-384`) and an overlap reranker are used in tests; the real models were downloaded successfully, so no fallback was needed for eval/smoke/e2e.
3. **Schema additions.** `messages.meta` (warnings, uncited claims, condensed query, sources, searched collections, no-answer reason), `query_logs.question_embedding` (unanswered clustering) and `query_logs.prompt` (trace), `eval_results.question_type/question`, `eval_runs.error`, `feedback` unique per (message, user) (re-voting updates), tables `staged_chunks` (embeddings computed on the `embed` queue before the atomic swap) and `web_page_states` (ETag/Last-Modified per crawled URL), extra indexes.
4. **API additions.** `GET /admin/query-logs` (list for the trace screen), `GET /sources/{id}/jobs` (sync history), sources PATCH/DELETE under `/collections/{id}/sources/{source_id}`, `degraded` in `/search`, `feedback` on `MessageOut`, `searched_collections`/`message_id`/`degraded` in the chat `meta` event, `content` (final post-processed text), `uncited_claims` and `cost_usd` in `done`. SSE for documents emits `ready` then `status` events.
5. **Celery.** No chord: the last embed batch that finishes enqueues `ingest.finalize`, which claims the ingestion job row `FOR UPDATE` and is a no-op if the job is no longer running (during development a chord callback was delivered five times because of stale kombu exchange bindings). Billiard is forced to `fork` on macOS (it defaulted to `spawn`, which breaks Celery's fast trace). Visibility timeout is configurable (`KB_VISIBILITY_TIMEOUT`, default 600 s). `KB_INGEST_DEBUG_DELAY_MS` injects a delay in parsing for the chaos tests.
6. **Upload versions.** Registering a file with the same name in the same collection updates the existing document (new version) and re-ingests it incrementally.
7. **LLMs.** `AnthropicLlm` (Messages streaming API, defaults `claude-opus-5-5` for answers, `claude-haiku-4-5` for condense, `claude-fable-5-1` as the stronger judge, effort `low`) and `OpenAiCompatibleLlm` are implemented and selected by `KB_LLM_PROVIDER`/`KB_JUDGE_PROVIDER`, but were not executed (no keys). Everything here ran with `FakeLlm` (answers from the most relevant source sentences with citations, deterministic condense) and `FakeJudge` (key-fact matching for correctness, claim support for faithfulness). Judge stability is computed by judging twice; with the fake it is trivially 1.0.
8. **Golden set format.** Added fields `key_facts` (exact strings a correct answer must contain), `forbidden` (for injection questions) and the type `injection`. The corpus was written with three parallel authors and cross-checked: every relevant page was verified by text extraction. Two finance documents referred to a "Procurement Policy (POL-FIN-005)" that was missing from the corpus; it now exists (`policies/procurement-policy.docx`, company-wide, consistent with the vendor-payment procedure, cost centers, expense and security policies) and is covered by golden questions `q090`/`q091`. The vendor-payment procedure also called the Expense Policy "POL-FIN-003" while the policy itself is POL-FIN-001; corrected. Only the two affected files were re-rendered (`corpus_builder.parse_source` + the format renderer) so the other 59 built files are byte-identical.
9. **No-answer threshold** τ = 0.10 on the sigmoid of the cross-encoder logit (chosen by the sweep); vector-only threshold 0.6.
10. **Unanswered clusters** are computed in Python (greedy: cosine ≥ 0.72 on question embeddings or content-term Jaccard ≥ 0.5), cached in Redis and refreshed by Beat every 5 minutes.
11. **Eval leakage oracle** is independent of the ACL code (from `collections.json` + `users.json`); collections unknown to the dataset are counted as `unjudged_chunks`, not as leaks.
12. **Keycloak.** Homebrew has no Keycloak formula, so `scripts/keycloak.sh` installs the official 26.8.0 tarball into `.tools/` and runs `start-dev` on 127.0.0.1:4480 (management 4481, `--cache=local`, heap ≤ 448 MB) with a fresh import of the realm on every start. Direct access grants are enabled on `kb-web` so scripts can obtain tokens; a production realm would disable them.
13. **Docker.** `docker-compose.yml` (root includes `infra/docker-compose.yml`), `backend/Dockerfile` (targets api, worker, beat, models) and `infra/web/Dockerfile` (nginx + runtime `config.json`) are written but were never built (no Docker here). The equivalent processes were verified natively by smoke and e2e. The Testcontainers path in `tests/support.py` (`TESTCONTAINERS=1`) is likewise unexecuted; locally tests use devinfra with throwaway databases.
14. **Frontend.** Initial bundle 393.6 kB (112 kB transfer) is under the 400 kB limit but above the 350 kB warning level, as before (379 kB): the runtime `$localize` and Angular's i18n instructions added ~19 kB; moving the admin `roleGuard` into the lazy admin routes and resolving route titles lazily took back ~9 kB, and self-hosted font CSS adds ~4 kB. The rest of the initial bundle is framework code (`@angular/core` 231 kB, router 98 kB, common 68 kB, rxjs 35 kB). The OIDC client is loaded by a dynamic import in `main.ts` together with `config.json`. ESLint relaxes `no-explicit-any` and a few rules for the generated client only (`src/app/core/api/**`, comments stripped by the TypeScript printer after generation); `noImplicitOverride` is off because the generated `request-builder.ts` violates it.
15. **MCP server** is a thin client over the HTTP API with the user's access token, so the ACL is exactly the API's. stdio uses `KB_MCP_TOKEN`; Streamable HTTP (`--transport streamable-http`, served by uvicorn on 127.0.0.1) forwards each caller's own `Authorization: Bearer` token to the API, rejects requests without one (401 + `WWW-Authenticate: Bearer`) and only falls back to `KB_MCP_TOKEN` if one is configured; the MCP server never trusts the header itself, the API verifies the JWT. API 401/403/404 are mapped to MCP tool errors ("not accessible with your permissions"). Verified with the official MCP Python SDK client (`mcp` 2.2, `Client` over stdio and Streamable HTTP) as two users against the real server process and a live API. Not connected to Claude Desktop (local-only rule; the protocol path is the same).
16. **Notion connector** is implemented (search or database query, blocks → Markdown, incremental by `last_edited_time`, archived/missing pages deleted) and tested only against a mocked API (no Notion token).
17. **Embedding-model switch** on a collection (`PATCH /collections/{id}` with `embedding_model`) reindexes with a vector-search gap for that collection; the zero-downtime two-column path is described in ADR 0011, not implemented.
18. **Not doable locally (M6):** VPS deployment with Caddy and nightly reset, screenshots/GIF/video.
19. **i18n.** `@angular/localize` with runtime translations (one build, no per-locale bundles): `main.ts` resolves the locale (stored choice → browser language → English), fetches `/i18n/messages.uk.json` and the Angular `uk` locale data in parallel with `config.json`, calls `loadTranslations()` and provides `LOCALE_ID` before bootstrapping, so dates/numbers/plurals follow the locale. Switching language stores the choice and reloads (compiled templates cache their messages). 539 messages with custom ids (`@@feature.component.key`), ICU plurals with Ukrainian one/few/many/other, four-form `plural()` helper for strings built in TypeScript; no `$localize` at module scope (titles are route resolvers, label maps are functions). Problem+json titles for known error codes are localized on the client; free-form server details, document content and LLM answers are not translated (answers follow the question's language by prompt). Keycloak realm has `internationalizationEnabled` with en/uk and receives `ui_locales`, so its login page follows the app language. `check-i18n.mjs` (Angular template AST + TypeScript AST) fails lint on any untranslated visible text or attribute; `verify-i18n-catalog.mjs` fails if the committed catalogs are stale or incomplete.
20. **Storybook** 10 (`@storybook/angular`, webpack builder via `@angular-devkit/build-angular` because Storybook's Angular framework still requires it; zoneless) for the six shared UI components, 19 stories with play functions. Tests run with the official `@storybook/test-runner` (`--index-json`) against the static build served locally on 4441. Telemetry is disabled (`core.disableTelemetry`, `STORYBOOK_DISABLE_TELEMETRY=1`).
21. **Lighthouse** 13 from npm, driven through puppeteer-core with Playwright's Chromium (`frontend/scripts/lighthouse.mjs`); each page is measured in a fresh browser context after a real Keycloak login (storage reset disabled so the OIDC session survives), desktop preset for five pages and the default mobile preset (simulated slow 4G, 4× CPU) for the chat page. Results (2026-10-05, built app served by `scripts/serve.mjs`, everything else running on the same laptop):

| Page | Form factor | Performance | Accessibility | Best practices | SEO | FCP | LCP | TBT | CLS | Transfer |
|---|---|---|---|---|---|---|---|---|---|---|
| `/chat` | desktop | 94 | 100 | 100 | 100 | 1.04 s | 1.37 s | 0 ms | 0.012 | 876 KiB |
| `/search` | desktop | 95 | 100 | 100 | 100 | 1.03 s | 1.30 s | 0 ms | 0.001 | 823 KiB |
| `/collections` | desktop | 97 | 100 | 100 | 100 | 0.64 s | 1.24 s | 0 ms | 0.001 | 834 KiB |
| `/admin/overview` (admin) | desktop | 95 | 100 | 100 | 100 | 0.98 s | 1.20 s | 0 ms | 0.073 | 963 KiB |
| `/chat` in Ukrainian | desktop | 98 | 100 | 100 | 100 | 0.74 s | 1.11 s | 0 ms | 0.017 | 910 KiB |
| `/chat` | mobile | 63 | 100 | 100 | 100 | 5.40 s | 7.05 s | 23 ms | 0.000 | 876 KiB |

The first run scored performance 82 / 85 / 85 / 74 / 87 (desktop) and 57 (mobile) and showed three fixable issues, now fixed: the local preview server sent JavaScript uncompressed (it now serves cached brotli/gzip like the production nginx config's gzip; transfer 1.8 MB → 0.9 MB), the admin page loaded the whole `echarts` package (now `echarts/core` with only bar/line charts, grid, legend, tooltip and the canvas renderer: 1.14 MB → 540 kB chunk), and `index.html` loaded Roboto and Material Symbols from Google Fonts (an external request; now self-hosted from `@fontsource/roboto` — latin and cyrillic subsets only — and `@material-symbols/font-400`). Remaining: the mobile score is limited by the request chain before first paint (HTML → JS → `config.json`/translations → OIDC discovery at Keycloak → API) and by the 480 kB Material Symbols font, which would need subsetting by icon name (not done: it needs an extra font tool and a reliable list of dynamically chosen icon names). Accessibility, best practices and SEO are 100 on every page.
22. **`KB_FUSED_TOP_K` default 20 instead of the specified 30**, decided by the sweep in "Evaluation results".

## Known gaps

- No OCR; no document-level permission overrides (by design, per spec).
- Prompt-injection protection is heuristic (fencing + output filters).
- Answer-quality numbers come from a deterministic fake judge; a real LLM-judged run needs `KB_ANTHROPIC_API_KEY` (`kb-eval run --mode full --llm-provider anthropic --judge-provider anthropic`).
- The CPU reranker dominates latency under load; first-token p95 is ≈ 10 s at 50 concurrent users on this laptop.
- Rate limiting is per user per minute in Redis (fixed window) plus a daily token budget; there is no global limit.
- Mobile Lighthouse performance is 63 (simulated slow 4G): the pre-render chain includes the OIDC discovery round trip, and the Material Symbols icon font (480 kB) is not subset.
- The MCP server was exercised with the official SDK client, not inside Claude Desktop or an IDE.
- Ukrainian covers the UI; server-provided free-form error details and the synthetic corpus are English.
