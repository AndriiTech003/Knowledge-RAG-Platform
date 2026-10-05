# DATA MODEL & API

## Модель прав

```text
Principal (из OIDC-токена): sub, email, name, groups[]
Collection: набор документов с общими правами (например "Finance", "Engineering RFCs", "Company Handbook")
CollectionGrant: (collection, principal_type = group | user, principal_id, role = viewer | editor | owner)
Документ наследует права коллекции. Переопределений на уровне документа в MVP нет (осознанно, README → Non-goals)
kb-admins — видят всё и управляют всем
```

Доступные коллекции пользователя:
```sql
select collection_id from collection_grants
where (principal_type = 'group' and principal_id = any(:groups))
   or (principal_type = 'user'  and principal_id = :sub)
```
Кэш в Redis `acl:{sub}:{hash(groups)}` на 60 сек. При изменении grants версия коллекций увеличивается → инвалидация.

## PostgreSQL

```sql
create table collections (
  id uuid primary key, name text not null, description text,
  embedding_model text not null,          -- модель, которой проиндексирована коллекция
  chunking_profile text not null default 'default',
  created_by text not null, created_at timestamptz not null default now()
);

create table collection_grants (
  collection_id uuid references collections(id) on delete cascade,
  principal_type text check (principal_type in ('group','user')),
  principal_id text not null,
  role text check (role in ('viewer','editor','owner')),
  primary key (collection_id, principal_type, principal_id)
);

create table sources (                    -- откуда приходят документы
  id uuid primary key, collection_id uuid references collections(id),
  kind text check (kind in ('upload','web','notion')),
  config jsonb not null,                  -- web: {startUrl, maxDepth, includePatterns, respectRobots}
  schedule text,                          -- cron для sync
  last_synced_at timestamptz, status text, last_error text
);

create table documents (
  id uuid primary key,
  collection_id uuid not null references collections(id) on delete cascade,
  source_id uuid references sources(id),
  external_id text,                       -- URL / notion page id / storage key
  title text not null,
  mime_type text not null,
  storage_key text,                       -- оригинал в MinIO
  content_hash text not null,             -- sha256 нормализованного текста
  page_count int,
  status text not null check (status in ('queued','parsing','chunking','embedding','ready','failed','deleted')),
  error text,
  metadata jsonb not null default '{}',   -- author, updated_at источника, язык
  created_at timestamptz default now(), updated_at timestamptz default now(),
  unique (collection_id, external_id)
);

create table chunks (
  id uuid primary key,
  document_id uuid not null references documents(id) on delete cascade,
  collection_id uuid not null,            -- денормализация для фильтра ACL без join
  ordinal int not null,
  text text not null,
  heading_path text[] not null default '{}',   -- ["Travel Policy","Per diem","Europe"]
  page_start int, page_end int,
  char_start int, char_end int,           -- для подсветки в превью
  token_count int not null,
  content_hash text not null,
  embedding vector(1024),
  embedding_model text,
  tsv tsvector generated always as (to_tsvector('english', text)) stored
);
create index on chunks using hnsw (embedding vector_cosine_ops);
create index on chunks using gin (tsv);
create index on chunks (collection_id);
create index on chunks (document_id, ordinal);

create table conversations (
  id uuid primary key, user_sub text not null, title text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table messages (
  id uuid primary key, conversation_id uuid references conversations(id) on delete cascade,
  role text check (role in ('user','assistant')),
  content text not null,
  citations jsonb,                        -- [{n, chunk_id, document_id, title, page, score}]
  status text,                            -- complete | no_answer | error | stopped
  query_log_id uuid,
  created_at timestamptz default now()
);

create table query_logs (
  id uuid primary key, user_sub text, conversation_id uuid,
  question text, condensed_question text,
  allowed_collections uuid[],
  retrieved jsonb,                        -- [{chunk_id, vector_rank, lexical_rank, rrf, rerank_score}]
  timings_ms jsonb,                       -- {acl, embed, vector, lexical, rerank, first_token, total}
  model text, prompt_version text,
  input_tokens int, output_tokens int, cost_usd numeric(10,6),
  outcome text,                           -- answered | no_answer | error
  created_at timestamptz default now()
);

create table feedback (
  id uuid primary key, message_id uuid references messages(id),
  user_sub text, rating smallint check (rating in (-1, 1)),
  reason text,                            -- wrong | incomplete | no_citation | outdated | other
  comment text, created_at timestamptz default now()
);

create table eval_runs (
  id uuid primary key, git_sha text, config jsonb,   -- {retrieval:'hybrid+rerank', chunk_size:500, model:…}
  dataset_version text, started_at timestamptz, finished_at timestamptz,
  metrics jsonb,                          -- агрегаты
  status text
);
create table eval_results (
  run_id uuid references eval_runs(id), question_id text,
  retrieved_doc_ids uuid[], answer text, metrics jsonb, judge_rationale text,
  primary key (run_id, question_id)
);

create table ingestion_jobs (
  id uuid primary key, document_id uuid, source_id uuid, kind text,
  status text, attempts int default 0, error text,
  started_at timestamptz, finished_at timestamptz,
  stats jsonb                             -- {chunks_total, chunks_new, chunks_unchanged, embed_ms}
);
```

## API (FastAPI, `/api/v1`)

Ошибки — `application/problem+json`. Пагинация — cursor. OpenAPI → генерация TypeScript-клиента для Angular (`openapi-generator` или `ng-openapi-gen`) — типы на фронте не пишутся руками.

### Коллекции и доступ
| Метод | Путь | Кто |
|---|---|---|
| GET | `/collections` | Видимые пользователю |
| POST | `/collections` | kb-admins |
| GET/PATCH/DELETE | `/collections/{id}` | owner / admin |
| GET/PUT | `/collections/{id}/grants` | owner / admin |
| GET | `/me` | Principal + группы + доступные коллекции |

### Документы и источники
| Метод | Путь | Описание |
|---|---|---|
| POST | `/collections/{id}/documents/upload-url` | Presigned PUT |
| POST | `/collections/{id}/documents` | Зарегистрировать загруженный файл → ingest |
| GET | `/collections/{id}/documents` | Фильтры: status, mime, q |
| GET | `/documents/{id}` | Метаданные + статистика чанков |
| GET | `/documents/{id}/download-url` | Presigned GET (после проверки ACL) |
| GET | `/documents/{id}/chunks` | Для отладки и превью |
| POST | `/documents/{id}/reindex` | editor+ |
| DELETE | `/documents/{id}` | editor+ |
| GET | `/documents/events` | **SSE**: статусы ingestion по доступным коллекциям |
| CRUD | `/collections/{id}/sources` | Web / Notion |
| POST | `/sources/{id}/sync` | Запустить синхронизацию |

### Поиск и чат
| Метод | Путь | Описание |
|---|---|---|
| POST | `/search` | `{query, collections?, mode: vector\|lexical\|hybrid, rerank: bool, k}` → чанки со скорами и подсветкой. Полезно и как фича, и для отладки |
| GET/POST | `/chat/conversations` | |
| GET/PATCH/DELETE | `/chat/conversations/{id}` | |
| GET | `/chat/conversations/{id}/messages` | |
| POST | `/chat/conversations/{id}/messages` | **SSE-стрим** ответа |
| POST | `/chat/messages/{id}/stop` | Остановить генерацию (отмена задачи, закрытие стрима провайдера) |
| POST | `/chat/messages/{id}/feedback` | 👍/👎 + причина |
| GET | `/chunks/{id}` | Текст чанка + документ + страница (для панели цитат) |

SSE events ответа:
```text
event: meta        data: {"query_log_id": "...", "condensed": "...", "sources": [{"n":1,"title":"Travel Policy","page":4}, …]}
event: token       data: {"t": "According to"}
event: citation    data: {"n": 1}                       -- модель сослалась на источник
event: no_answer   data: {"reason": "low_relevance", "best_score": 0.21}
event: done        data: {"usage": {...}, "timings_ms": {...}, "citations": [...], "warnings": ["uncited_sentence"]}
event: error       data: {"code": "LLM_UNAVAILABLE"}
```

### Админка и качество
| Метод | Путь | Описание |
|---|---|---|
| GET | `/admin/analytics/overview?from&to` | Запросы, пользователи, доля no_answer, 👍/👎, p50/p95 латентности, стоимость |
| GET | `/admin/analytics/unanswered` | Кластеры неотвеченных вопросов (группировка по embedding) — подсказка, каких документов не хватает |
| GET | `/admin/analytics/negative-feedback` | С вопросом, ответом и найденными чанками |
| GET | `/admin/query-logs/{id}` | Полный трейс запроса |
| GET | `/admin/eval/runs` | История прогонов |
| GET | `/admin/eval/runs/{id}` | Метрики + результаты по вопросам |
| GET | `/admin/eval/compare?a=&b=` | Сравнение двух прогонов по вопросам (что улучшилось/ухудшилось) |
| POST | `/admin/eval/runs` | Запустить прогон (celery `eval`) |
| GET | `/health/live`, `/health/ready`, `/metrics` | |
