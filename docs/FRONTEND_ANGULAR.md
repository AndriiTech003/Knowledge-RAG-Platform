# FRONTEND · Angular

Цель — показать **современный Angular**, а не Angular 2017 года: standalone, signals, новый control flow, zoneless, functional guards/interceptors, `resource`/`httpResource`, SignalStore.

## Стек

| Задача | Выбор |
|---|---|
| Версия | Angular 20+ (последняя стабильная на момент старта), standalone-компоненты, **zoneless** change detection |
| Реактивность | Signals (`signal`, `computed`, `effect`, `linkedSignal`), `resource()` / `httpResource()` для загрузки данных; RxJS там, где нужны потоки (SSE, debounce поиска) + `toSignal` / `toObservable` |
| Состояние | NgRx SignalStore (feature stores: chat, documents, admin) |
| UI | Angular Material 3 + CDK (virtual scroll, overlay, drag-drop), своя тема (light/dark) |
| Формы | Typed reactive forms (`FormGroup<{…}>`), кастомные валидаторы |
| Auth | `angular-auth-oidc-client` (Authorization Code + PKCE, silent renew), functional `authGuard`, `roleGuard` |
| HTTP | Сгенерированный из OpenAPI клиент + functional interceptors: auth, problem+json → typed errors, retry для GET, correlation id |
| Markdown | `ngx-markdown` (marked + DOMPurify) с кастомным рендером цитат `[n]` → компонент-чип |
| PDF | `ngx-extended-pdf-viewer` (pdf.js): открыть на странице + подсветить текст фрагмента |
| Графики | ngx-echarts |
| i18n | `@angular/localize` или Transloco: en + uk (опционально) |
| Тесты | Vitest (или Jest) + Angular Testing Library, Playwright E2E, Storybook для UI-компонентов (опционально) |
| Качество | ESLint (angular-eslint), strict templates, `strictTemplates: true`, OnPush по умолчанию (в zoneless это естественно) |

## Структура

```text
frontend/src/app/
├── app.config.ts             # provideZonelessChangeDetection, provideRouter(withComponentInputBinding), provideHttpClient(withInterceptors), auth
├── app.routes.ts             # lazy loadChildren на фичи
├── core/
│   ├── auth/                 # auth.config.ts, auth.guard.ts, role.guard.ts, current-user.store.ts
│   ├── http/                 # interceptors: auth, errors, retry; problem-details.ts
│   ├── api/                  # сгенерированный клиент (не редактируется руками)
│   ├── sse/                  # sseStream<T>(url, body): Observable<SseEvent<T>> на fetch + ReadableStream (POST + Bearer — EventSource этого не умеет)
│   └── layout/               # shell, sidenav, topbar, theme toggle
├── shared/
│   ├── ui/                   # citation-chip, empty-state, status-badge, confirm-dialog, file-drop-zone, skeleton
│   └── pipes/                # relativeTime, fileSize, highlight
└── features/
    ├── chat/                 # conversations list, chat thread, composer, sources panel, chat.store.ts
    ├── search/
    ├── collections/          # список, детали, документы, загрузка, источники, доступы
    ├── document-viewer/
    └── admin/                # analytics, unanswered, feedback, query-log trace, eval runs & compare
```

## Экраны

### 1. Chat (главный)
- Слева — список бесед (CDK virtual scroll, поиск, переименование inline).
- Центр — поток сообщений:
  - стриминг токенов: сигнал `draft` обновляется батчами по `requestAnimationFrame`, чтобы markdown не перерендеривался на каждый токен;
  - цитаты `[1]` — чипы, при наведении превью фрагмента (CDK overlay), по клику справа открывается панель источника;
  - «Searched for: …» (condensed query) мелким текстом;
  - кнопка Stop во время генерации (abort → `POST /stop`);
  - 👍/👎 с формой причины;
  - состояние no_answer — отдельная карточка «Не нашёл в доступных вам документах» + подсказка, в каких коллекциях искалось;
  - предупреждения `uncited_claim` — пунктирное подчёркивание с тултипом.
- Справа — **Sources panel**: список источников ответа (документ, секция, страница, скор). Клик открывает PDF-вьюер на странице с подсветкой фрагмента (по `char_start`/`char_end` → поиск текста в pdf.js).
- Composer: Enter — отправить, Shift+Enter — новая строка, выбор коллекций (фильтр поиска), автоувеличение высоты.
- Горячие клавиши: `⌘K` — новая беседа, `/` — фокус в поле ввода.

### 2. Search
- Поле с debounce (RxJS `debounceTime` + `switchMap` для отмены предыдущего запроса), переключатель режима vector / lexical / hybrid и reranker on/off — **для наглядного сравнения** (полезно на демо и при отладке).
- Результаты: фрагмент с подсветкой терминов, документ, страница, скоры по каждому этапу (vector rank, lexical rank, RRF, rerank).

### 3. Collections & Documents
- Карточки коллекций с количеством документов и ролью пользователя.
- Документы: таблица (MatTable + сортировка + фильтры) со статусами, которые **обновляются в реальном времени через SSE** (`queued → parsing → chunking → embedding → ready`) с анимированным бейджем.
- Загрузка: drag-n-drop нескольких файлов, параллельно не больше 3, прогресс каждого (`HttpClient` с `reportProgress` на presigned PUT), отмена, повтор при ошибке.
- Детали документа: метаданные, статистика ingestion («188 unchanged, 12 re-embedded»), список чанков с `heading_path`, reindex.
- Источники: форма web-коннектора (typed reactive form: URL, глубина, include/exclude-паттерны с валидацией regex), расписание, «Sync now», история синхронизаций.
- Доступы: таблица grants (группа/пользователь → роль), автодополнение групп.

### 4. Admin
- **Overview**: запросы/день, активные пользователи, доля no_answer, 👍/👎, p50/p95 латентности, first-token latency, стоимость.
- **Unanswered**: кластеры неотвеченных вопросов с количеством. Для контент-команды это ответ на вопрос «какие документы надо написать».
- **Negative feedback**: вопрос → ответ → найденные чанки → причина.
- **Query trace**: для любого запроса — waterfall таймингов (acl, embed, vector, lexical, rerank, first token, total), таблица кандидатов со всеми скорами, итоговый промпт (свёрнут). Это экран отладки RAG, он производит сильное впечатление.
- **Eval**: список прогонов (git sha, конфиг, метрики с дельтами), сравнение двух прогонов по вопросам (улучшилось / ухудшилось / без изменений, фильтр по типу вопроса), детали вопроса: найденные документы, ответ, rationale judge.

Доступ к `admin/*` — `roleGuard('kb-admins')`, пункты меню скрываются через `@if (user.isAdmin())`.

## Паттерны, которые стоит показать в коде

```ts
// SignalStore с загрузкой через rxMethod и состоянием стрима
export const ChatStore = signalStore(
  withState<ChatState>({ conversations: [], activeId: null, messages: [], streaming: null, error: null }),
  withComputed(({ messages, streaming }) => ({
    thread: computed(() => streaming() ? [...messages(), streaming()!] : messages()),
    isStreaming: computed(() => streaming() !== null),
  })),
  withMethods((store, api = inject(ChatApi), sse = inject(SseClient)) => ({
    send: rxMethod<string>(pipe(
      exhaustMap(content => sse.stream(`/chat/conversations/${store.activeId()}/messages`, { content }).pipe(
        scan(applySseEvent, initialDraft(content)),          // meta / token / citation / done
        tap(draft => patchState(store, { streaming: draft })),
        finalize(() => patchState(store, commitDraft)),
        catchError(err => { patchState(store, { error: toProblem(err) }); return EMPTY; }),
      )),
    )),
  })),
);
```

- `httpResource()` для простых GET (списки коллекций, детали документа) с автоматической перезагрузкой при изменении параметров-сигналов.
- `input()` / `output()` / `model()` вместо декораторов; `withComponentInputBinding()` для параметров роута.
- `@defer (on viewport)` для тяжёлых виджетов (PDF-вьюер, графики).
- Error handling: interceptor превращает problem+json в `AppError` с `code`, глобальный `ErrorHandler` + toasts, локальные ошибки на уровне фич.
- Доступность: aria-live для стримящегося ответа (вежливо, не на каждый токен — по предложениям), фокус-менеджмент в панелях, контраст.
- Производительность: бюджеты бандла в `angular.json` (initial < 400 KB), lazy routes, `@defer`, OnPush/zoneless. Lighthouse-отчёт в README.

## Тесты фронта
- Unit: stores (SignalStore), функции парсинга SSE и применения событий, пайпы, guards, interceptors (HttpTestingController).
- Компоненты: Angular Testing Library (chat thread рендерит цитаты, upload показывает прогресс и ошибки).
- E2E (Playwright + Keycloak в compose):
  1. alice логинится → загружает PDF → статус доходит до ready → задаёт вопрос → ответ с цитатой → клик открывает PDF на нужной странице.
  2. bob и carol: одинаковый вопрос про бюджет → разные результаты (permission).
  3. Admin: запускает eval → видит прогон и сравнение.
