import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ChatMessage, CollectionRefLite } from './chat.models';
import { FeedbackControls, FeedbackSubmission } from './feedback-controls';
import { MessageContent } from './message-content';
import { NoAnswerCard } from './no-answer-card';

export interface CitationOpenEvent {
  messageId: string;
  n: number | null;
}

export interface FeedbackEvent extends FeedbackSubmission {
  messageId: string;
}

@Component({
  selector: 'kb-chat-thread',
  imports: [MessageContent, NoAnswerCard, FeedbackControls, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './chat-thread.html',
  styleUrl: './chat-thread.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatThread {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly messages = input.required<ChatMessage[]>();
  readonly fallbackCollections = input<CollectionRefLite[]>([]);
  readonly activeSource = input<CitationOpenEvent | null>(null);
  readonly citationOpened = output<CitationOpenEvent>();
  readonly feedback = output<FeedbackEvent>();

  private readonly warningLabels: Record<string, string> = {
    uncited_claim: $localize`:@@chat.thread.warningUncited:Some statements are not backed by a cited source`,
    uncited_sentence: $localize`:@@chat.thread.warningUncited:Some statements are not backed by a cited source`,
    invalid_citation: $localize`:@@chat.thread.warningInvalidCitation:An invalid citation was removed`,
    removed_url: $localize`:@@chat.thread.warningRemovedUrl:A link not present in the sources was removed`,
    suspicious_content_removed: $localize`:@@chat.thread.warningSuspicious:Suspicious instructions found in a source were ignored`,
  };

  private readonly errorLabels: Record<string, string> = {
    LLM_UNAVAILABLE: $localize`:@@chat.thread.errorLlmUnavailable:The language model is temporarily unavailable. Please try again in a moment.`,
    RATE_LIMITED: $localize`:@@chat.thread.errorRateLimited:You are sending questions too quickly. Please wait a moment and try again.`,
    DAILY_TOKEN_LIMIT: $localize`:@@chat.thread.errorDailyLimit:You have reached your daily usage limit. It resets tomorrow.`,
    NETWORK: $localize`:@@chat.thread.errorNetwork:The connection was interrupted.`,
  };

  protected readonly lastContentLength = computed(() => {
    const list = this.messages();
    const last = list[list.length - 1];
    return `${list.length}:${last?.content.length ?? 0}:${last?.status ?? ''}`;
  });

  constructor() {
    afterRenderEffect(() => {
      this.lastContentLength();
      const scroller = this.host.nativeElement.closest('.chat__scroll');
      if (scroller) scroller.scrollTop = scroller.scrollHeight;
    });
  }

  protected warningLabel(code: string): string {
    return this.warningLabels[code] ?? code.replace(/_/g, ' ');
  }

  protected errorLabel(code: string | null): string {
    return (code && this.errorLabels[code]) || $localize`:@@chat.thread.errorGeneric:Something went wrong while generating the answer.`;
  }

  protected activeN(message: ChatMessage): number | null {
    const active = this.activeSource();
    return active && active.messageId === message.id ? active.n : null;
  }

  protected sourceCount(message: ChatMessage): number {
    return new Set([...message.sources.map((s) => s.n), ...message.citations.map((c) => c.n)]).size;
  }

  protected searched(message: ChatMessage): CollectionRefLite[] {
    return message.searchedCollections.length ? message.searchedCollections : this.fallbackCollections();
  }
}
