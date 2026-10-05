import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import {
  EMPTY,
  Observable,
  Subject,
  auditTime,
  catchError,
  exhaustMap,
  filter,
  finalize,
  firstValueFrom,
  map,
  of,
  pipe,
  scan,
  startWith,
  switchMap,
  takeUntil,
  tap,
} from 'rxjs';
import { ConversationOut } from '../../core/api/models';
import { ChatService, FeedbackService } from '../../core/api/services';
import { AppError } from '../../core/http/app-error';
import { SseClient } from '../../core/sse/sse-client';
import { frameScheduler } from '../../core/util/frame-scheduler';
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
import { ChatMessage, ChatSseEvent, FeedbackReason, StreamDraft } from './chat.models';

export interface SourcesPanelState {
  messageId: string;
  n: number | null;
}

export interface ChatState {
  conversations: ConversationOut[];
  conversationsLoading: boolean;
  conversationQuery: string;
  activeId: string | null;
  messages: ChatMessage[];
  messagesLoading: boolean;
  streaming: StreamDraft | null;
  error: AppError | null;
  selectedCollections: string[];
  sourcesPanel: SourcesPanelState | null;
}

export interface SendRequest {
  content: string;
  collections?: string[];
}

export const initialChatState: ChatState = {
  conversations: [],
  conversationsLoading: false,
  conversationQuery: '',
  activeId: null,
  messages: [],
  messagesLoading: false,
  streaming: null,
  error: null,
  selectedCollections: [],
  sourcesPanel: null,
};

export const ChatStore = signalStore(
  withState<ChatState>(initialChatState),
  withComputed(({ messages, streaming, conversations, activeId }) => ({
    thread: computed(() => {
      const draft = streaming();
      return draft ? [...messages(), draft.user, draft.assistant] : messages();
    }),
    isStreaming: computed(() => streaming() !== null),
    activeConversation: computed(() => conversations().find((c) => c.id === activeId()) ?? null),
    liveAnnouncement: computed(() => {
      const draft = streaming();
      return draft ? completedSentences(draft.assistant.content) : '';
    }),
  })),
  withComputed(({ thread, sourcesPanel }) => ({
    panelMessage: computed(() => {
      const panel = sourcesPanel();
      return panel ? (thread().find((m) => m.id === panel.messageId) ?? null) : null;
    }),
  })),
  withComputed(({ panelMessage, sourcesPanel }) => ({
    panelSources: computed(() => {
      const message = panelMessage();
      return message ? sourceRows(message) : [];
    }),
    panelSelected: computed(() => {
      const message = panelMessage();
      const n = sourcesPanel()?.n ?? null;
      if (!message || n === null) return null;
      return sourceRows(message).find((row) => row.n === n) ?? null;
    }),
  })),
  withMethods((store, chatApi = inject(ChatService), feedbackApi = inject(FeedbackService), sse = inject(SseClient)) => {
    const stop$ = new Subject<void>();

    const fail = (error: unknown) => patchState(store, { error: AppError.from(error) });

    const loadConversations = rxMethod<string>(
      pipe(
        tap((q) => patchState(store, { conversationQuery: q, conversationsLoading: true })),
        switchMap((q) =>
          chatApi.listConversations({ q: q.trim() || null, limit: 100 }).pipe(
            tap((page) => patchState(store, { conversations: page.items, conversationsLoading: false })),
            catchError((error: unknown) => {
              patchState(store, { conversationsLoading: false });
              fail(error);
              return EMPTY;
            }),
          ),
        ),
      ),
    );

    const refreshConversations = () => loadConversations(store.conversationQuery());

    const stopStream = () => {
      const draft = store.streaming();
      if (!draft) return;
      const id = draft.assistant.id;
      if (!isLocalId(id)) chatApi.stopMessage({ message_id: id }).pipe(catchError(() => EMPTY)).subscribe();
      stop$.next();
    };

    const selectConversation = rxMethod<string | null>(
      pipe(
        filter((id) => id !== store.activeId() || (id !== null && store.messages().length === 0 && !store.isStreaming())),
        tap((id) => {
          stopStream();
          patchState(store, { activeId: id, messages: [], messagesLoading: id !== null, sourcesPanel: null, error: null });
        }),
        switchMap((id) =>
          id === null
            ? EMPTY
            : chatApi.listMessages({ conversation_id: id, limit: 100 }).pipe(
                map((page) => page.items.map(fromMessageOut)),
                tap((messages) => patchState(store, { messages, messagesLoading: false })),
                catchError((error: unknown) => {
                  patchState(store, { messagesLoading: false });
                  fail(error);
                  return EMPTY;
                }),
              ),
        ),
      ),
    );

    const ensureConversation = (content: string): Observable<string> => {
      const active = store.activeId();
      if (active) return of(active);
      return chatApi.createConversation({ body: { title: content.slice(0, 80) } }).pipe(
        tap((conversation) =>
          patchState(store, (state) => ({
            conversations: [conversation, ...state.conversations.filter((c) => c.id !== conversation.id)],
            activeId: conversation.id,
          })),
        ),
        map((conversation) => conversation.id),
      );
    };

    const send = rxMethod<SendRequest>(
      pipe(
        filter((request) => request.content.trim().length > 0),
        exhaustMap((request) => {
          const content = request.content.trim();
          const collections = request.collections ?? store.selectedCollections();
          const seed = initialDraft(content);
          patchState(store, { streaming: seed, error: null });
          return ensureConversation(content).pipe(
            switchMap((conversationId) =>
              sse.stream<unknown>(`/chat/conversations/${conversationId}/messages`, {
                content,
                collections: collections.length ? collections : null,
              }),
            ),
            map(toChatEvent),
            filter((event): event is ChatSseEvent => event !== null),
            scan(applySseEvent, seed),
            startWith(seed),
            auditTime(0, frameScheduler()),
            tap((draft) => patchState(store, { streaming: draft })),
            takeUntil(stop$),
            catchError((error: unknown) => {
              const appError = AppError.from(error);
              patchState(store, (state) => ({ error: appError, streaming: failDraft(state.streaming, appError.code) }));
              return EMPTY;
            }),
            finalize(() => {
              patchState(store, (state) => commitDraft(state));
              refreshConversations();
            }),
          );
        }),
      ),
    );

    return {
      loadConversations,
      selectConversation,
      send,
      stop(): void {
        stopStream();
      },
      newConversation(): void {
        stopStream();
        patchState(store, { activeId: null, messages: [], sourcesPanel: null, error: null });
      },
      setSelectedCollections(ids: string[]): void {
        patchState(store, { selectedCollections: ids });
      },
      openSources(messageId: string, n: number | null = null): void {
        patchState(store, { sourcesPanel: { messageId, n } });
      },
      selectSource(n: number): void {
        const panel = store.sourcesPanel();
        if (panel) patchState(store, { sourcesPanel: { ...panel, n } });
      },
      closeSources(): void {
        patchState(store, { sourcesPanel: null });
      },
      clearError(): void {
        patchState(store, { error: null });
      },
      async rename(id: string, title: string): Promise<boolean> {
        const trimmed = title.trim();
        if (!trimmed) return false;
        try {
          const updated = await firstValueFrom(chatApi.renameConversation({ conversation_id: id, body: { title: trimmed } }));
          patchState(store, (state) => ({ conversations: state.conversations.map((c) => (c.id === id ? updated : c)) }));
          return true;
        } catch (error) {
          fail(error);
          return false;
        }
      },
      async remove(id: string): Promise<boolean> {
        try {
          await firstValueFrom(chatApi.deleteConversation({ conversation_id: id }));
          if (store.activeId() === id) {
            stopStream();
            patchState(store, { activeId: null, messages: [], sourcesPanel: null });
          }
          patchState(store, (state) => ({ conversations: state.conversations.filter((c) => c.id !== id) }));
          return true;
        } catch (error) {
          fail(error);
          return false;
        }
      },
      async feedback(messageId: string, rating: 1 | -1, reason: FeedbackReason | null = null, comment: string | null = null): Promise<boolean> {
        try {
          await firstValueFrom(
            feedbackApi.sendFeedback({ message_id: messageId, body: { rating, reason, comment: comment?.trim() || null } }),
          );
          patchState(store, (state) => ({
            messages: state.messages.map((m) => (m.id === messageId ? { ...m, feedback: rating } : m)),
          }));
          return true;
        } catch (error) {
          fail(error);
          return false;
        }
      },
    };
  }),
);

export type ChatStoreInstance = InstanceType<typeof ChatStore>;
