import { MessageOut } from '../../core/api/models';
import { SseEvent } from '../../core/sse/sse-parser';
import {
  ChatCitation,
  ChatMessage,
  ChatSource,
  ChatSseEvent,
  CollectionRefLite,
  MessageStatus,
  SourceRow,
  StreamDraft,
} from './chat.models';

const EVENT_NAMES = new Set(['meta', 'token', 'citation', 'no_answer', 'done', 'error']);

let localCounter = 0;

export function localId(prefix: string): string {
  localCounter += 1;
  return `local-${prefix}-${Date.now().toString(36)}-${localCounter}`;
}

export function isLocalId(id: string): boolean {
  return id.startsWith('local-');
}

export function emptyMessage(role: ChatMessage['role'], content: string, status: MessageStatus, createdAt: string): ChatMessage {
  return {
    id: localId(role),
    role,
    content,
    status,
    createdAt,
    sources: [],
    citations: [],
    citedNumbers: [],
    condensed: null,
    searchedCollections: [],
    warnings: [],
    uncitedClaims: [],
    noAnswer: null,
    usage: null,
    errorCode: null,
    queryLogId: null,
    feedback: null,
  };
}

export function initialDraft(content: string, now: Date = new Date()): StreamDraft {
  const createdAt = now.toISOString();
  return {
    user: emptyMessage('user', content, 'complete', createdAt),
    assistant: emptyMessage('assistant', '', 'streaming', createdAt),
  };
}

export function toChatEvent(raw: SseEvent<unknown>): ChatSseEvent | null {
  if (!EVENT_NAMES.has(raw.event) || raw.data === null || typeof raw.data !== 'object') return null;
  return raw as ChatSseEvent;
}

function withAssistant(draft: StreamDraft, patch: Partial<ChatMessage>): StreamDraft {
  return { ...draft, assistant: { ...draft.assistant, ...patch } };
}

export function applySseEvent(draft: StreamDraft, event: ChatSseEvent): StreamDraft {
  switch (event.event) {
    case 'meta':
      return {
        user: { ...draft.user, id: event.data.user_message_id || draft.user.id },
        assistant: {
          ...draft.assistant,
          id: event.data.message_id || draft.assistant.id,
          condensed: event.data.condensed ?? null,
          sources: event.data.sources ?? [],
          searchedCollections: event.data.searched_collections ?? [],
          queryLogId: event.data.query_log_id ?? null,
        },
      };
    case 'token':
      return withAssistant(draft, { content: draft.assistant.content + (event.data.t ?? '') });
    case 'citation':
      return draft.assistant.citedNumbers.includes(event.data.n)
        ? draft
        : withAssistant(draft, { citedNumbers: [...draft.assistant.citedNumbers, event.data.n] });
    case 'no_answer':
      return withAssistant(draft, {
        noAnswer: { reason: event.data.reason, best_score: event.data.best_score ?? null },
        status: 'no_answer',
      });
    case 'done': {
      const data = event.data;
      const citations = data.citations ?? [];
      const cited = new Set([...draft.assistant.citedNumbers, ...citations.map((c) => c.n)]);
      return withAssistant(draft, {
        id: data.message_id || draft.assistant.id,
        status: data.status ?? (draft.assistant.noAnswer ? 'no_answer' : 'complete'),
        content: typeof data.content === 'string' ? data.content : draft.assistant.content,
        citations,
        citedNumbers: [...cited].sort((a, b) => a - b),
        warnings: data.warnings ?? [],
        uncitedClaims: data.uncited_claims ?? [],
        usage: data.usage ?? null,
        queryLogId: data.query_log_id ?? draft.assistant.queryLogId,
      });
    }
    case 'error':
      return withAssistant(draft, { status: 'error', errorCode: event.data.code ?? 'INTERNAL' });
    default:
      return draft;
  }
}

export function finalizeAssistant(message: ChatMessage): ChatMessage {
  return message.status === 'streaming' ? { ...message, status: 'stopped' } : message;
}

export function commitDraft<S extends { messages: ChatMessage[]; streaming: StreamDraft | null }>(
  state: S,
): Pick<S, 'messages' | 'streaming'> {
  const draft = state.streaming;
  if (!draft) return { messages: state.messages, streaming: null };
  return { messages: [...state.messages, draft.user, finalizeAssistant(draft.assistant)], streaming: null };
}

export function failDraft(draft: StreamDraft | null, code: string): StreamDraft | null {
  if (!draft) return null;
  return withAssistant(draft, { status: 'error', errorCode: code });
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

export function toCitation(raw: Record<string, unknown>): ChatCitation {
  return {
    n: asNumber(raw['n']) ?? 0,
    chunk_id: asString(raw['chunk_id']) ?? '',
    document_id: asString(raw['document_id']) ?? '',
    title: asString(raw['title']) ?? $localize`:@@chat.source.untitled:Untitled`,
    section: asString(raw['section']),
    page: asNumber(raw['page']),
    page_end: asNumber(raw['page_end']),
    char_start: asNumber(raw['char_start']),
    char_end: asNumber(raw['char_end']),
    mime_type: asString(raw['mime_type']),
    score: asNumber(raw['score']),
    snippet: asString(raw['snippet']),
  };
}

function toSource(raw: unknown): ChatSource | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = toCitation(raw as Record<string, unknown>);
  return { n: c.n, title: c.title, page: c.page, section: c.section, chunk_id: c.chunk_id, document_id: c.document_id, score: c.score };
}

export function fromMessageOut(message: MessageOut): ChatMessage {
  const meta = (message.meta ?? {}) as Record<string, unknown>;
  const citations = (message.citations ?? []).map((c) => toCitation(c as Record<string, unknown>));
  const status = (message.status ?? 'complete') as MessageStatus;
  const searched = Array.isArray(meta['searched_collections'])
    ? (meta['searched_collections'] as unknown[]).filter(
        (c): c is CollectionRefLite => !!c && typeof c === 'object' && typeof (c as CollectionRefLite).id === 'string',
      )
    : [];
  const sources = Array.isArray(meta['sources'])
    ? (meta['sources'] as unknown[]).map(toSource).filter((s): s is ChatSource => s !== null)
    : [];
  const feedback = message.feedback?.rating ?? asNumber(meta['feedback']);
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    status,
    createdAt: message.created_at,
    sources,
    citations,
    citedNumbers: [...new Set(citations.map((c) => c.n))].sort((a, b) => a - b),
    condensed: asString(meta['condensed']),
    searchedCollections: searched,
    warnings: asStringArray(meta['warnings']),
    uncitedClaims: asStringArray(meta['uncited_claims']),
    noAnswer: status === 'no_answer' ? { reason: asString(meta['no_answer_reason']) ?? asString(meta['reason']) ?? 'low_relevance', best_score: asNumber(meta['best_score']) } : null,
    usage: null,
    errorCode: asString(meta['error_code']),
    queryLogId: message.query_log_id,
    feedback: feedback === 1 || feedback === -1 ? feedback : null,
  };
}

export function sourceRows(message: ChatMessage): SourceRow[] {
  const byN = new Map<number, SourceRow>();
  for (const source of message.sources) {
    byN.set(source.n, { ...source, cited: message.citedNumbers.includes(source.n), citation: null });
  }
  for (const citation of message.citations) {
    const existing = byN.get(citation.n);
    byN.set(citation.n, {
      ...(existing ?? citation),
      page: citation.page ?? existing?.page ?? null,
      cited: true,
      citation,
    });
  }
  return [...byN.values()].sort((a, b) => Number(b.cited) - Number(a.cited) || a.n - b.n);
}

export function findSource(message: ChatMessage, n: number): SourceRow | null {
  return sourceRows(message).find((row) => row.n === n) ?? null;
}

export function completedSentences(text: string): string {
  const match = text.match(/^[\s\S]*[.!?](?=\s|$)/);
  return match ? match[0].replace(/\[\d+\]/g, '').trim() : '';
}
