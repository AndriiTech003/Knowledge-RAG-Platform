import { httpResource } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { NgxExtendedPdfViewerModule, NgxExtendedPdfViewerService, PagesLoadedEvent } from 'ngx-extended-pdf-viewer';
import { ChunkDetail, DownloadUrl, PageChunkOut } from '../../core/api/models';
import { injectApiV1 } from '../../core/http/api-url';
import { highlightPhrase } from './highlight-phrase';

@Component({
  selector: 'kb-document-viewer',
  imports: [NgxExtendedPdfViewerModule, MatProgressBarModule, MatIconModule, MatButtonModule],
  providers: [NgxExtendedPdfViewerService],
  templateUrl: './document-viewer.html',
  styleUrl: './document-viewer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentViewer {
  private readonly api = injectApiV1();
  private readonly pdf = inject(NgxExtendedPdfViewerService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly documentId = input.required<string>();
  readonly page = input<number | null>(null);
  readonly chunkId = input<string | null>(null);
  readonly height = input('100%');

  protected readonly download = httpResource<DownloadUrl>(() => this.api(`/documents/${this.documentId()}/download-url`));
  protected readonly chunk = httpResource<ChunkDetail>(() => {
    const id = this.chunkId();
    return id ? this.api(`/chunks/${id}`) : undefined;
  });
  protected readonly isPdf = computed(() => {
    const value = this.download.value();
    if (!value) return false;
    return value.mime_type === 'application/pdf' || value.filename.toLowerCase().endsWith('.pdf');
  });
  protected readonly chunks = httpResource<PageChunkOut>(() => {
    const value = this.download.value();
    if (!value || this.isPdf()) return undefined;
    return { url: this.api(`/documents/${this.documentId()}/chunks`), params: { limit: 500 } };
  });

  protected readonly targetPage = computed(() => this.page() ?? this.chunk.value()?.page_start ?? 1);
  protected readonly currentPage = linkedSignal(() => this.targetPage());
  protected readonly pageCount = signal<number | null>(null);
  protected readonly phrase = computed(() => highlightPhrase(this.chunk.value()?.text));
  protected readonly pdfSrc = computed(() => (this.isPdf() ? (this.download.value()?.url ?? null) : null));
  private loaded = false;

  constructor() {
    afterRenderEffect(() => {
      const items = this.chunks.value()?.items;
      const id = this.chunkId();
      if (!items || !id) return;
      const target = this.host.nativeElement.querySelector(`[data-chunk-id="${id}"]`);
      target?.scrollIntoView({ block: 'center' });
    });
  }

  protected onPagesLoaded(event: PagesLoadedEvent): void {
    this.pageCount.set(event.pagesCount);
    this.loaded = true;
    this.currentPage.set(this.targetPage());
    this.runFind();
  }

  protected onPageChange(page: number | undefined): void {
    if (page) this.currentPage.set(page);
  }

  protected runFind(): void {
    const phrase = this.phrase();
    if (!this.loaded || !phrase) return;
    try {
      this.pdf.find(phrase, { highlightAll: true, matchCase: false, wholeWords: false, dontScrollIntoView: false });
    } catch {
      return;
    }
  }
}
