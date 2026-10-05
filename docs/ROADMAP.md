# ROADMAP · Knowledge RAG Platform (6–8 недель)

## M0 — Фундамент (0.5 недели)
- [ ] Monorepo: `backend/` (uv, ruff, mypy --strict, pytest), `frontend/` (Angular CLI, strict), `infra/`
- [ ] docker compose: Postgres + pgvector, Redis, MinIO, Keycloak (импорт realm с группами и демо-пользователями), models-контейнер (локальные embeddings и reranker)
- [ ] FastAPI каркас: settings, lifespan, problem+json, OTel, health, `/metrics`
- [ ] Alembic, базовые таблицы
- [ ] CI: ruff, mypy, pytest (unit + integration с testcontainers), Angular lint + test + build

## M1 — Auth, коллекции, ACL (1 неделя)
- [ ] Валидация OIDC-токенов (JWKS-кэш), Principal с группами
- [ ] Collections, grants, вычисление доступных коллекций + кэш
- [ ] Angular: shell, OIDC-логин (PKCE), guards, interceptors, сгенерированный API-клиент, экран коллекций и доступов
- [ ] Тесты: матрица «пользователь × коллекция × действие»

## M2 — Ingestion (1.5 недели)
- [ ] Presigned upload, регистрация документа
- [ ] Парсеры PDF / DOCX / MD / HTML, структурный чанкер, contextual prefix
- [ ] Celery: очереди ingest / embed, ретраи, `acks_late`, статусы + Redis pub/sub → SSE
- [ ] Инкрементальная индексация по хэшам
- [ ] Web-коннектор (sitemap, robots, ETag), Celery Beat
- [ ] Angular: документы с live-статусами, drag-n-drop загрузка с прогрессом, детали документа, форма источника
- [ ] Корпус Northwind (~60 документов) + скрипт загрузки
- [ ] Тесты: парсеры на фикстурах (включая «сложный» PDF с колонтитулами и таблицами), чанкер (property: ни один чанк не превышает max_tokens, текст не теряется), инкрементальность, kill воркера во время ingest

## M3 — Retrieval + eval harness (1.5 недели)
- [ ] Vector + lexical поиск с ACL-фильтром, RRF, reranker, MMR по документам
- [ ] `POST /search` + Angular Search со сравнением режимов
- [ ] Golden dataset (~80 вопросов всех типов)
- [ ] Eval runner: retrieval-метрики + leakage; CI-gate с порогами и комментарием в PR
- [ ] Прогон конфигураций → первая версия таблицы экспериментов
- [ ] ADR: pre-filter ACL, hybrid + RRF, reranker, chunking

**Готово, когда:** leakage = 0, recall@8 ≥ 0.85 на наборе, таблица экспериментов показывает вклад каждого шага.

## M4 — Chat + генерация (1.5 недели)
- [ ] Conversations, condense, порог no_answer (подбор τ на eval), промпт v1, провайдеры LLM + FakeLlm
- [ ] SSE-стрим, stop, post-processing цитат, guardrails, учёт токенов и стоимости, query_logs
- [ ] Feedback
- [ ] Angular: чат со стримингом, цитаты-чипы, Sources panel, PDF-вьюер с подсветкой, no_answer, stop, feedback
- [ ] Eval: генерация + LLM-judge (faithfulness, correctness, citation precision, no-answer accuracy), nightly workflow
- [ ] Тест на prompt injection: документ с вредоносной инструкцией в корпусе → ответ не выполняет её (в golden-наборе)

## M5 — Админка и эксплуатация (1 неделя)
- [ ] Analytics overview, unanswered-кластеры, negative feedback, query trace (waterfall)
- [ ] Eval-экраны: список прогонов, сравнение по вопросам
- [ ] Rate limits, дневной лимит токенов, Grafana-дашборд (латентность по шагам, стоимость, очередь Celery)
- [ ] Нагрузка (Locust): 50 одновременных пользователей чата с FakeLlm → узкие места retrieval (пул соединений, ef_search), цифры в README

## M6 — Полировка (0.5–1 неделя)
- [ ] (Опционально) MCP-сервер `search_knowledge`
- [ ] (Опционально) Notion-коннектор
- [ ] Деплой демо (VPS, Caddy, Keycloak за тем же доменом), ночной сброс
- [ ] Публичный README (EN), скриншоты, GIF стриминга с цитатами, видео 2 минуты
- [ ] Known limitations: нет OCR, нет прав на уровне документа, LLM-judge — приближение, корпус синтетический

## Сценарий видео (2 минуты)
1. Alice загружает PDF → live-статусы → ready (12 сек).
2. Вопрос → стриминг ответа с цитатами → клик по `[2]` → PDF открывается на странице 4 с подсветкой.
3. Follow-up «а для Европы?» → «Searched for: …».
4. Carol и Bob: один вопрос, разные ответы (права доступа).
5. Вопрос, ответа на который нет → честный отказ → он появляется в Admin → Unanswered.
6. Admin → Query trace: waterfall и скоры кандидатов.
7. Eval: таблица конфигураций, PR-комментарий с метриками из CI.

## Highlights для README (EN)
- Permission-aware retrieval: ACL is applied **before** ranking; leakage is a hard CI gate (0 by design, verified on every PR)
- Hybrid search (pgvector + Postgres FTS) with RRF and cross-encoder reranking; each step justified by measured recall
- Answers with page-level citations that open the source PDF at the highlighted passage
- Evaluation harness: 80-question golden set, retrieval metrics on every PR, LLM-judged faithfulness nightly
- Honest "I don't know": relevance threshold tuned on unanswerable questions; unanswered questions surface to admins
- Modern Angular: standalone, signals, zoneless, SignalStore, SSE streaming; enterprise SSO via Keycloak (OIDC + PKCE)
