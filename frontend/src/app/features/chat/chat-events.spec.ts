import { ANSWER_EVENTS, META } from '../../../testing/chat-fixtures';
import {
  applySseEvent,
  commitDraft,
  completedSentences,
  failDraft,
  fromMessageOut,
  initialDraft,
  isLocalId,
  sourceRows,
  toChatEvent,
} from './chat-events';
import { ChatMessage, ChatSseEvent, StreamDraft } from './chat.models';

function run(events: ChatSseEvent[], draft: StreamDraft = initialDraft('What was the budget?')): StreamDraft {
  return events.reduce(applySseEvent, draft);
}

describe('applySseEvent', () => {
  it('starts with a local user message and an empty streaming assistant message', () => {
    const draft = initialDraft('Hello');
    expect(draft.user.content).toBe('Hello');
    expect(draft.assistant.status).toBe('streaming');
    expect(isLocalId(draft.assistant.id)).toBe(true);
  });

  it('meta assigns server ids, sources, condensed query and searched collections', () => {
    const draft = run([{ event: 'meta', data: META }]);
    expect(draft.user.id).toBe('user-1');
    expect(draft.assistant.id).toBe('assistant-1');
    expect(draft.assistant.sources).toHaveLength(2);
    expect(draft.assistant.condensed).toBe('q3 marketing budget');
    expect(draft.assistant.searchedCollections[0].name).toBe('Finance Reports');
    expect(draft.assistant.queryLogId).toBe('log-1');
  });

  it('token events append to the draft content', () => {
    const draft = run(ANSWER_EVENTS.slice(0, 3));
    expect(draft.assistant.content).toBe('The budget is $420,000 [1].');
    expect(draft.assistant.status).toBe('streaming');
  });

  it('citation events record each cited number once', () => {
    const draft = run([...ANSWER_EVENTS.slice(0, 4), { event: 'citation', data: { n: 1 } }, { event: 'citation', data: { n: 2 } }]);
    expect(draft.assistant.citedNumbers).toEqual([1, 2]);
  });

  it('done replaces the streamed draft with the final post-processed content', () => {
    const draft = run(ANSWER_EVENTS);
    expect(draft.assistant.content).toBe('The approved budget is $420,000 [1].');
    expect(draft.assistant.status).toBe('complete');
    expect(draft.assistant.citations[0].page).toBe(3);
    expect(draft.assistant.usage?.model).toBe('fake-llm');
  });

  it('no_answer marks the message and keeps the best score', () => {
    const draft = run([
      { event: 'meta', data: { ...META, sources: [] } },
      { event: 'no_answer', data: { reason: 'low_relevance', best_score: 0.12 } },
      { event: 'done', data: { message_id: 'assistant-1', query_log_id: 'log-1', status: 'no_answer', content: 'Not found.' } },
    ]);
    expect(draft.assistant.status).toBe('no_answer');
    expect(draft.assistant.noAnswer).toEqual({ reason: 'low_relevance', best_score: 0.12 });
  });

  it('done carries warnings and uncited claims', () => {
    const done = ANSWER_EVENTS[4];
    if (done.event !== 'done') throw new Error('fixture');
    const draft = run([{ event: 'done', data: { ...done.data, warnings: ['uncited_claim'], uncited_claims: ['It is great.'] } }]);
    expect(draft.assistant.warnings).toEqual(['uncited_claim']);
    expect(draft.assistant.uncitedClaims).toEqual(['It is great.']);
  });

  it('error events mark the assistant message as failed', () => {
    const draft = run([{ event: 'error', data: { code: 'LLM_UNAVAILABLE' } }]);
    expect(draft.assistant.status).toBe('error');
    expect(draft.assistant.errorCode).toBe('LLM_UNAVAILABLE');
  });

  it('toChatEvent rejects unknown events', () => {
    expect(toChatEvent({ event: 'ping', data: {}, id: null })).toBeNull();
    expect(toChatEvent({ event: 'token', data: { t: 'x' }, id: null })?.event).toBe('token');
  });
});

describe('draft lifecycle helpers', () => {
  it('commitDraft moves the draft into messages and marks unfinished answers as stopped', () => {
    const draft = run(ANSWER_EVENTS.slice(0, 2));
    const next = commitDraft({ messages: [] as ChatMessage[], streaming: draft });
    expect(next.streaming).toBeNull();
    expect(next.messages.map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(next.messages[1].status).toBe('stopped');
  });

  it('failDraft flags the assistant with an error code', () => {
    expect(failDraft(initialDraft('x'), 'RATE_LIMITED')?.assistant.errorCode).toBe('RATE_LIMITED');
    expect(failDraft(null, 'X')).toBeNull();
  });

  it('completedSentences only exposes finished sentences for aria-live', () => {
    expect(completedSentences('First sentence. Second is still stream')).toBe('First sentence.');
    expect(completedSentences('No sentence yet')).toBe('');
    expect(completedSentences('Cited [1]. More.')).toBe('Cited . More.');
  });

  it('fromMessageOut maps stored history messages', () => {
    const message = fromMessageOut({
      id: 'm1',
      conversation_id: 'c',
      role: 'assistant',
      content: 'Answer [1].',
      citations: [{ n: 1, chunk_id: 'c1', document_id: 'd1', title: 'Doc', page: 2, score: 0.8 }],
      meta: { warnings: ['uncited_claim'], uncited_claims: ['x'], condensed: 'cond', best_score: 0.8 },
      status: 'complete',
      query_log_id: 'log',
      created_at: '2026-01-01T00:00:00Z',
    });
    expect(message.citations[0].page).toBe(2);
    expect(message.citedNumbers).toEqual([1]);
    expect(message.condensed).toBe('cond');
    expect(message.warnings).toEqual(['uncited_claim']);
  });

  it('restores sources, searched collections, no-answer reason and feedback from stored history', () => {
    const answered = fromMessageOut({
      id: 'm2',
      conversation_id: 'c',
      role: 'assistant',
      content: 'Answer [1].',
      citations: [{ n: 1, chunk_id: 'c1', document_id: 'd1', title: 'Doc', page: 2, score: 0.8 }],
      meta: { sources: META.sources, searched_collections: META.searched_collections, warnings: [], uncited_claims: [] },
      status: 'complete',
      query_log_id: 'log',
      created_at: '2026-01-01T00:00:00Z',
      feedback: { rating: 1, reason: null, comment: null },
    });
    expect(sourceRows(answered).map((r) => [r.n, r.cited])).toEqual([
      [1, true],
      [2, false],
    ]);
    expect(answered.searchedCollections).toEqual([{ id: 'col-fin', name: 'Finance Reports' }]);
    expect(answered.feedback).toBe(1);

    const refused = fromMessageOut({
      id: 'm3',
      conversation_id: 'c',
      role: 'assistant',
      content: 'Not found.',
      citations: null,
      meta: { sources: [], searched_collections: [{ id: 'col-sales', name: 'Sales Playbooks' }], no_answer_reason: 'no_access', best_score: 0.01 },
      status: 'no_answer',
      query_log_id: 'log',
      created_at: '2026-01-01T00:00:00Z',
      feedback: { rating: -1, reason: 'wrong', comment: 'x' },
    });
    expect(refused.noAnswer).toEqual({ reason: 'no_access', best_score: 0.01 });
    expect(refused.searchedCollections.map((c) => c.name)).toEqual(['Sales Playbooks']);
    expect(refused.feedback).toBe(-1);
  });

  it('treats a missing feedback field as no feedback', () => {
    const message = fromMessageOut({ id: 'm4', conversation_id: 'c', role: 'assistant', content: 'x', citations: null, meta: null, status: 'complete', query_log_id: null, created_at: '', feedback: null });
    expect(message.feedback).toBeNull();
    expect(message.sources).toEqual([]);
  });

  it('sourceRows merges retrieved sources with citations and orders cited first', () => {
    const draft = run(ANSWER_EVENTS);
    const rows = sourceRows(draft.assistant);
    expect(rows.map((r) => [r.n, r.cited])).toEqual([
      [1, true],
      [2, false],
    ]);
    expect(rows[0].citation?.snippet).toBe('approved marketing budget');
  });
});
