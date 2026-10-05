import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ChunkDetail } from '../../core/api/models';
import { ChunkPreviewService } from './chunk-preview.service';

const POSITIONS: ConnectedPosition[] = [
  { originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom', offsetY: -6 },
  { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top', offsetY: 6 },
];

export function previewText(text: string, max = 360): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

@Component({
  selector: 'kb-citation-chip',
  imports: [CdkOverlayOrigin, CdkConnectedOverlay],
  template: `
    <button
      type="button"
      class="chip"
      [class.chip--active]="active()"
      [class.chip--missing]="!chunkId()"
      cdkOverlayOrigin
      #origin="cdkOverlayOrigin"
      (mouseenter)="openPreview()"
      (mouseleave)="closePreview()"
      (focus)="openPreview()"
      (blur)="closePreview()"
      (click)="onClick($event)"
      [attr.aria-label]="ariaLabel()"
      [attr.data-n]="n()"
      data-testid="citation-chip"
    >
      {{ n() }}
    </button>
    <ng-template
      cdkConnectedOverlay
      [cdkConnectedOverlayOrigin]="origin"
      [cdkConnectedOverlayOpen]="previewOpen()"
      [cdkConnectedOverlayPositions]="positions"
      (overlayOutsideClick)="previewOpen.set(false)"
    >
      <div class="kb-cite-preview" role="tooltip" data-testid="citation-preview">
        <div class="preview__title">
          <strong>{{ heading() }}</strong>
          @if (pageLabel()) {
            <span> · {{ pageLabel() }}</span>
          }
        </div>
        @if (section()) {
          <div class="preview__section">{{ section() }}</div>
        }
        <div class="preview__text">
          @if (loading()) {
            <span i18n="@@ui.citation.loading">Loading fragment…</span>
          } @else if (text()) {
            {{ text() }}
          } @else {
            <span i18n="@@ui.citation.unavailable">Preview unavailable.</span>
          }
        </div>
      </div>
    </ng-template>
  `,
  styles: `
    :host {
      display: inline;
    }
    .chip {
      display: inline-grid;
      place-items: center;
      min-width: 20px;
      height: 20px;
      margin: 0 2px;
      padding: 0 6px;
      border: 0;
      border-radius: 10px;
      vertical-align: text-top;
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
      font: var(--mat-sys-label-small);
      font-weight: 600;
      cursor: pointer;
    }
    .chip:hover,
    .chip:focus-visible,
    .chip--active {
      background: var(--mat-sys-primary);
      color: var(--mat-sys-on-primary);
      outline: none;
    }
    .chip--missing {
      opacity: 0.6;
    }
    .preview__title {
      margin-bottom: 4px;
    }
    .preview__section {
      margin-bottom: 6px;
      color: var(--mat-sys-on-surface-variant);
    }
    .preview__text {
      line-height: 1.45;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CitationChip {
  private readonly previews = inject(ChunkPreviewService);
  private readonly destroyRef = inject(DestroyRef);

  readonly n = input.required<number>();
  readonly chunkId = input<string | null>(null);
  readonly title = input<string | null>(null);
  readonly page = input<number | null>(null);
  readonly section = input<string | null>(null);
  readonly snippet = input<string | null>(null);
  readonly active = input(false);
  readonly activate = output<number>();

  protected readonly positions = POSITIONS;
  protected readonly previewOpen = signal(false);
  protected readonly loading = signal(false);
  protected readonly detail = signal<ChunkDetail | null>(null);
  private requested = false;
  private hoverTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly pageLabel = computed(() => {
    const page = this.page() ?? this.detail()?.page_start ?? null;
    return page ? $localize`:@@ui.citation.page:p. ${page}:page:` : '';
  });
  protected readonly text = computed(() => {
    const detail = this.detail();
    if (detail) return previewText(detail.text);
    const snippet = this.snippet();
    return snippet ? previewText(snippet.replace(/<[^>]+>/g, '')) : '';
  });
  protected readonly heading = computed(
    () => this.title() || this.detail()?.document_title || $localize`:@@ui.citation.source:Source ${this.n()}:n:`,
  );
  protected readonly ariaLabel = computed(() => {
    const parts = [$localize`:@@ui.citation.source:Source ${this.n()}:n:`];
    if (this.title()) parts.push(this.title() as string);
    if (this.pageLabel()) parts.push(this.pageLabel());
    return parts.join(', ');
  });

  protected openPreview(): void {
    if (this.hoverTimer) clearTimeout(this.hoverTimer);
    this.hoverTimer = setTimeout(() => this.previewOpen.set(true), 150);
    this.load();
  }

  protected closePreview(): void {
    if (this.hoverTimer) clearTimeout(this.hoverTimer);
    this.hoverTimer = null;
    this.previewOpen.set(false);
  }

  protected onClick(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.closePreview();
    this.activate.emit(this.n());
  }

  private load(): void {
    const id = this.chunkId();
    if (!id || this.requested) return;
    this.requested = true;
    this.loading.set(true);
    this.previews
      .get(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((detail) => {
        this.detail.set(detail);
        this.loading.set(false);
      });
  }
}
