import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, input, untracked, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CurrentUserStore } from '../../core/auth/current-user.store';
import { NotificationService } from '../../core/errors/notification.service';
import { ConfirmService } from '../../shared/ui/confirm-dialog';
import { EmptyState } from '../../shared/ui/empty-state';
import { ChatStore } from './chat.store';
import { ChatThread, CitationOpenEvent, FeedbackEvent } from './chat-thread';
import { Composer } from './composer';
import { ConversationList, RenameEvent } from './conversation-list';
import { SourcesPanel } from './sources-panel';

@Component({
  selector: 'kb-chat-page',
  imports: [ConversationList, ChatThread, Composer, SourcesPanel, EmptyState, MatButtonModule, MatIconModule, MatProgressBarModule],
  templateUrl: './chat-page.html',
  styleUrl: './chat-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown)': 'onKeydown($event)',
  },
})
export class ChatPage implements OnInit {
  protected readonly store = inject(ChatStore);
  protected readonly user = inject(CurrentUserStore);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  private readonly notify = inject(NotificationService);

  readonly conversationId = input<string | undefined>(undefined);
  readonly new = input<string | undefined>(undefined);

  protected readonly suggestions = [
    $localize`:@@chat.page.suggestionVacation:How many vacation days do new employees get?`,
    $localize`:@@chat.page.suggestionOnCall:What is the on-call escalation policy?`,
    $localize`:@@chat.page.suggestionTravel:How do I file a travel expense?`,
  ];
  protected readonly composer = viewChild(Composer);
  protected readonly fallbackCollections = computed(() => this.user.collections().map((c) => ({ id: c.id, name: c.name })));
  protected readonly activeSource = computed<CitationOpenEvent | null>(() => this.store.sourcesPanel());
  protected readonly selectedCollections = computed(() => this.store.selectedCollections());
  protected readonly conversationTitle = computed(() => this.store.activeConversation()?.title || $localize`:@@chat.conversation.newTitle:New conversation`);
  private readonly search$ = new Subject<string>();

  constructor() {
    effect(() => {
      const id = this.conversationId() ?? null;
      untracked(() => this.store.selectConversation(id));
    });
    effect(() => {
      const marker = this.new();
      if (!marker) return;
      untracked(() => {
        this.store.newConversation();
        void this.router.navigate(['/chat'], { replaceUrl: true });
        queueMicrotask(() => this.composer()?.focus());
      });
    });
    effect(() => {
      const active = this.store.activeId();
      const routed = this.conversationId() ?? null;
      if (active && routed === null) {
        untracked(() => void this.router.navigate(['/chat', active], { replaceUrl: true }));
      }
    });
    effect(() => {
      const error = this.store.error();
      if (error && error.code !== 'RATE_LIMITED' && error.code !== 'DAILY_TOKEN_LIMIT') {
        untracked(() => {
          this.notify.error(error.userMessage);
          this.store.clearError();
        });
      }
    });
    this.search$
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((q) => this.store.loadConversations(q));
  }

  ngOnInit(): void {
    this.store.loadConversations(this.store.conversationQuery());
  }

  protected onSearch(q: string): void {
    this.search$.next(q);
  }

  protected select(id: string): void {
    void this.router.navigate(['/chat', id]);
  }

  protected newChat(): void {
    this.store.newConversation();
    void this.router.navigate(['/chat']);
    queueMicrotask(() => this.composer()?.focus());
  }

  protected async rename(event: RenameEvent): Promise<void> {
    if (await this.store.rename(event.id, event.title)) this.notify.success($localize`:@@chat.page.renamed:Conversation renamed`);
  }

  protected remove(id: string): void {
    this.confirm
      .confirm({
        title: $localize`:@@chat.page.deleteTitle:Delete conversation?`,
        message: $localize`:@@chat.page.deleteMessage:This conversation and its messages will be deleted.`,
        confirmText: $localize`:@@common.delete:Delete`,
        destructive: true,
      })
      .subscribe(async (ok) => {
        if (!ok) return;
        const wasActive = this.store.activeId() === id;
        if ((await this.store.remove(id)) && wasActive) void this.router.navigate(['/chat']);
      });
  }

  protected send(content: string): void {
    this.store.send({ content, collections: this.store.selectedCollections() });
  }

  protected ask(question: string): void {
    this.send(question);
  }

  protected openCitation(event: CitationOpenEvent): void {
    this.store.openSources(event.messageId, event.n);
  }

  protected async sendFeedback(event: FeedbackEvent): Promise<void> {
    if (await this.store.feedback(event.messageId, event.rating, event.reason, event.comment)) {
      this.notify.success($localize`:@@chat.page.feedbackRecorded:Thanks! Your feedback was recorded.`);
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    const tag = target?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) return;
    event.preventDefault();
    this.composer()?.focus();
  }
}
