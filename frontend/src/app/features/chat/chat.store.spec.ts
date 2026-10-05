import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { ChatService, FeedbackService } from '../../core/api/services';
import { AppError } from '../../core/http/app-error';
import { SseClient } from '../../core/sse/sse-client';
import { SseEvent } from '../../core/sse/sse-parser';
import { ANSWER_EVENTS } from '../../../testing/chat-fixtures';
import { flushMicrotasks } from '../../../testing/test-helpers';
import { ChatStore } from './chat.store';

function setup() {
  const stream = new Subject<SseEvent<unknown>>();
  const chat = {
    listConversations: vi.fn(() => of({ items: [{ id: 'conv-1', title: 'Old', created_at: '', updated_at: '' }], next_cursor: null })),
    createConversation: vi.fn(() => of({ id: 'conv-new', title: 'What', created_at: '', updated_at: '' })),
    listMessages: vi.fn(() =>
      of({
        items: [
          { id: 'u', conversation_id: 'conv-1', role: 'user', content: 'Hi', citations: null, meta: null, status: 'complete', query_log_id: null, created_at: '' },
          { id: 'a', conversation_id: 'conv-1', role: 'assistant', content: 'Hello [1].', citations: [], meta: {}, status: 'complete', query_log_id: null, created_at: '' },
        ],
        next_cursor: null,
      }),
    ),
    stopMessage: vi.fn(() => of({ stopped: true })),
    renameConversation: vi.fn(() => of({ id: 'conv-1', title: 'Renamed', created_at: '', updated_at: '' })),
    deleteConversation: vi.fn(() => of(undefined)),
  };
  const feedback = { sendFeedback: vi.fn(() => of({ id: 'f', message_id: 'a', rating: 1, reason: null, comment: null, created_at: '' })) };
  const sse = { stream: vi.fn(() => stream.asObservable()) };
  TestBed.configureTestingModule({
    providers: [
      ChatStore,
      { provide: ChatService, useValue: chat },
      { provide: FeedbackService, useValue: feedback },
      { provide: SseClient, useValue: sse },
    ],
  });
  return { store: TestBed.inject(ChatStore), chat, feedback, sse, stream };
}

describe('ChatStore', () => {
  it('loads conversations', () => {
    const { store, chat } = setup();
    store.loadConversations('');
    expect(chat.listConversations).toHaveBeenCalledWith({ q: null, limit: 100 });
    expect(store.conversations()[0].id).toBe('conv-1');
  });

  it('selects a conversation and maps its messages', () => {
    const { store } = setup();
    store.selectConversation('conv-1');
    expect(store.activeId()).toBe('conv-1');
    expect(store.thread().map((m) => m.role)).toEqual(['user', 'assistant']);
  });

  it('creates a conversation on first send and streams the answer into a draft', async () => {
    const { store, chat, sse, stream } = setup();
    store.send({ content: 'What was the budget?' });
    expect(chat.createConversation).toHaveBeenCalled();
    expect(store.activeId()).toBe('conv-new');
    expect(sse.stream).toHaveBeenCalledWith('/chat/conversations/conv-new/messages', { content: 'What was the budget?', collections: null });
    expect(store.isStreaming()).toBe(true);
    for (const event of ANSWER_EVENTS.slice(0, 3)) stream.next({ event: event.event, data: event.data, id: null });
    await flushMicrotasks(40);
    expect(store.streaming()?.assistant.content).toBe('The budget is $420,000 [1].');
    expect(store.liveAnnouncement()).toBe('The budget is $420,000 .');
    stream.next({ event: 'done', data: ANSWER_EVENTS[4].data, id: null });
    stream.complete();
    await flushMicrotasks(40);
    expect(store.isStreaming()).toBe(false);
    const last = store.messages()[store.messages().length - 1];
    expect(last.status).toBe('complete');
    expect(last.content).toBe('The approved budget is $420,000 [1].');
  });

  it('ignores a second send while a stream is in flight (exhaustMap)', () => {
    const { store, sse } = setup();
    store.send({ content: 'first' });
    store.send({ content: 'second' });
    expect(sse.stream).toHaveBeenCalledTimes(1);
  });

  it('stop aborts the stream, calls the stop endpoint and keeps a stopped message', async () => {
    const { store, chat, stream } = setup();
    store.send({ content: 'Question' });
    stream.next({ event: 'meta', data: ANSWER_EVENTS[0].data, id: null });
    stream.next({ event: 'token', data: { t: 'Partial' }, id: null });
    await flushMicrotasks(40);
    store.stop();
    expect(chat.stopMessage).toHaveBeenCalledWith({ message_id: 'assistant-1' });
    expect(store.isStreaming()).toBe(false);
    expect(stream.observed).toBe(false);
    expect(store.messages()[1].status).toBe('stopped');
  });

  it('records rate-limit errors raised before the stream starts', async () => {
    const { store, sse } = setup();
    sse.stream.mockReturnValueOnce(throwError(() => new AppError('RATE_LIMITED', 'Too many requests', 429)));
    store.send({ content: 'Question' });
    await flushMicrotasks(10);
    expect(store.error()?.code).toBe('RATE_LIMITED');
    expect(store.messages()[1].status).toBe('error');
    expect(store.messages()[1].errorCode).toBe('RATE_LIMITED');
  });

  it('opens the sources panel for a message and selects a source', () => {
    const { store } = setup();
    store.selectConversation('conv-1');
    store.openSources('a', null);
    expect(store.panelMessage()?.id).toBe('a');
    store.selectSource(1);
    expect(store.sourcesPanel()?.n).toBe(1);
    store.closeSources();
    expect(store.panelMessage()).toBeNull();
  });

  it('sends feedback and marks the message', async () => {
    const { store, feedback } = setup();
    store.selectConversation('conv-1');
    await store.feedback('a', -1, 'wrong', ' bad ');
    expect(feedback.sendFeedback).toHaveBeenCalledWith({ message_id: 'a', body: { rating: -1, reason: 'wrong', comment: 'bad' } });
    expect(store.messages()[1].feedback).toBe(-1);
  });

  it('renames and deletes conversations', async () => {
    const { store } = setup();
    store.loadConversations('');
    await store.rename('conv-1', 'Renamed');
    expect(store.conversations()[0].title).toBe('Renamed');
    await store.remove('conv-1');
    expect(store.conversations()).toHaveLength(0);
  });
});
