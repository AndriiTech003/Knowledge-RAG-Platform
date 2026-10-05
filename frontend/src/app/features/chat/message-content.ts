import {
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  ComponentRef,
  ElementRef,
  EnvironmentInjector,
  Injector,
  OnDestroy,
  computed,
  createComponent,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import { MarkdownComponent } from 'ngx-markdown';
import { CitationChip } from '../../shared/ui/citation-chip';
import { sourceRows } from './chat-events';
import { ChatMessage } from './chat.models';
import { renderableMarkdown } from './message-render';

@Component({
  selector: 'kb-message-content',
  imports: [MarkdownComponent],
  template: `
    <markdown class="content" [data]="markdown()" (ready)="attachChips()" data-testid="message-markdown" />
    @if (streaming()) {
      <span class="cursor" aria-hidden="true"></span>
    }
  `,
  styles: `
    :host {
      display: block;
      line-height: 1.6;
      overflow-wrap: anywhere;
    }
    .content ::ng-deep p:first-child {
      margin-top: 0;
    }
    .content ::ng-deep p:last-child {
      margin-bottom: 0;
    }
    .content ::ng-deep table {
      border-collapse: collapse;
      margin: 8px 0;
    }
    .content ::ng-deep th,
    .content ::ng-deep td {
      border: 1px solid var(--mat-sys-outline-variant);
      padding: 4px 8px;
    }
    .content ::ng-deep pre {
      overflow: auto;
      padding: 12px;
      border-radius: 8px;
      background: var(--mat-sys-surface-container-highest);
    }
    .cursor {
      display: inline-block;
      width: 8px;
      height: 16px;
      margin-left: 2px;
      vertical-align: text-bottom;
      background: var(--mat-sys-primary);
      animation: blink 1s steps(2, start) infinite;
    }
    @keyframes blink {
      to { visibility: hidden; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessageContent implements OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly appRef = inject(ApplicationRef);
  private readonly environmentInjector = inject(EnvironmentInjector);
  private readonly injector = inject(Injector);

  readonly message = input.required<ChatMessage>();
  readonly activeN = input<number | null>(null);
  readonly citationActivated = output<number>();

  private chips: ComponentRef<CitationChip>[] = [];

  protected readonly streaming = computed(() => this.message().status === 'streaming');
  protected readonly markdown = computed(() => renderableMarkdown(this.message().content, this.message().uncitedClaims));
  private readonly rows = computed(() => new Map(sourceRows(this.message()).map((row) => [row.n, row])));

  constructor() {
    effect(() => {
      const active = this.activeN();
      for (const ref of this.chips) ref.setInput('active', ref.instance.n() === active);
    });
  }

  attachChips(): void {
    this.destroyChips();
    const placeholders = this.host.nativeElement.querySelectorAll<HTMLElement>('span.kb-cite[data-n]');
    placeholders.forEach((element) => {
      const n = Number.parseInt(element.dataset['n'] ?? '', 10);
      if (!Number.isFinite(n)) return;
      const row = this.rows().get(n);
      const ref = createComponent(CitationChip, {
        environmentInjector: this.environmentInjector,
        elementInjector: this.injector,
        hostElement: element,
      });
      ref.setInput('n', n);
      ref.setInput('chunkId', row?.chunk_id ?? null);
      ref.setInput('title', row?.title ?? null);
      ref.setInput('page', row?.page ?? null);
      ref.setInput('section', row?.section ?? null);
      ref.setInput('snippet', row?.citation?.snippet ?? null);
      ref.setInput('active', this.activeN() === n);
      ref.instance.activate.subscribe((value) => this.citationActivated.emit(value));
      this.appRef.attachView(ref.hostView);
      ref.changeDetectorRef.detectChanges();
      this.chips.push(ref);
    });
  }

  ngOnDestroy(): void {
    this.destroyChips();
  }

  private destroyChips(): void {
    for (const ref of this.chips) {
      this.appRef.detachView(ref.hostView);
      ref.destroy();
    }
    this.chips = [];
  }
}
