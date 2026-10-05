# 04 · Knowledge RAG Platform (Python + Angular)

> Корпоративная база знаний с AI-ассистентом: документы из разных источников, гибридный поиск, ответы со ссылками на страницы, **права доступа на уровне документов** и **eval-харнес в CI**, который измеряет качество поиска и ответов на каждом PR.

## Почему именно этот проект на Python + Angular

- **Python** — естественный язык для AI/data. Здесь есть работа, которую на Python делать правильно: парсинг документов, локальные embeddings и reranker, evaluation-метрики.
- **Angular** — стандарт корпоративных фронтендов (банки, страхование, B2B SaaS). Enterprise-сценарий (SSO через OIDC, группы, права, админка) подходит ему идеально.
- Проект не повторяет флагман: там AI принимает решения (bandits), здесь AI отвечает на вопросы. Там Node/React, здесь Python/Angular.

## Что отличает от «загрузил PDF и спросил ChatGPT»

| Обычный RAG-пет-проект | Этот проект |
|---|---|
| Только векторный поиск | Гибрид: pgvector + полнотекстовый поиск → RRF → cross-encoder reranking |
| Все видят всё | ACL по группам из SSO; фильтрация **до** поиска; тест на утечки — жёсткий gate в CI |
| «Кажется, работает» | Golden dataset + метрики (recall@k, MRR, faithfulness, citation precision) на каждом PR, сравнение конфигураций в README |
| Ответ без источников | Цитаты `[n]` → клик открывает PDF на нужной странице с подсветкой фрагмента |
| Придумывает, если не знает | Порог релевантности → честное «в базе нет ответа» + лог неотвеченных вопросов для админа |
| Переиндексация всего | Инкрементальная синхронизация по хэшам: пересчитываются только изменённые чанки |
| Нет эксплуатации | Трейсинг каждого запроса (какие чанки найдены, скоры, латентность шагов), стоимость, фидбэк |

## Стек

| Слой | Технология |
|---|---|
| API | Python 3.13, FastAPI, Pydantic v2, SQLAlchemy 2.0 (async) + asyncpg, Alembic |
| Фоновые задачи | Celery + Redis (broker), Celery Beat для синхронизаций |
| Данные | PostgreSQL 17 + pgvector (HNSW) + full-text search, Redis, MinIO (S3) для файлов |
| AI | Абстракции `Embedder`, `Reranker`, `LlmClient`; локальные модели (sentence-transformers) для dev и CI, API-провайдеры в проде |
| Auth | Keycloak (OIDC, Authorization Code + PKCE), группы из токена |
| Frontend | Angular 20+ (standalone, signals, zoneless), NgRx SignalStore, Angular Material 3, CDK |
| Качество | uv, Ruff, mypy --strict, pytest + testcontainers, Vitest/Jest для Angular, Playwright |
| Observability | OpenTelemetry (FastAPI + Celery + SQLAlchemy), Prometheus, Grafana |

## Документация

| Файл | Содержание |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Компоненты, потоки, структура репозитория, решения |
| [docs/DATA_MODEL_AND_API.md](docs/DATA_MODEL_AND_API.md) | Схема БД, модель прав, endpoints |
| [docs/RAG_PIPELINE.md](docs/RAG_PIPELINE.md) | Ingestion, chunking, поиск, генерация, guardrails, **evaluation** |
| [docs/FRONTEND_ANGULAR.md](docs/FRONTEND_ANGULAR.md) | Архитектура Angular-приложения, экраны, паттерны |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Milestones, тесты, демо, README |

## Демо-данные

Вымышленная компания **Northwind Labs**: ~60 документов (handbook, политики, инженерные RFC, продуктовые спеки, финансовые отчёты, HR-политики) в PDF, DOCX, Markdown и HTML. Часть документов доступна только группам `finance` или `hr`.

Демо-пользователи в Keycloak:

| Пользователь | Группы | Что видит |
|---|---|---|
| `alice` | engineering | Общие + инженерные |
| `bob` | sales | Общие + продажи |
| `carol` | finance | Общие + финансы |
| `admin` | kb-admins | Всё + админка |

Сценарий демо: Bob и Carol задают один и тот же вопрос про бюджет Q3. Carol получает ответ с цитатой из финансового отчёта, Bob — «в доступных вам документах нет ответа». Показывает права доступа за 10 секунд.
