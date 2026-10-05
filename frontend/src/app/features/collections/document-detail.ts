import { DatePipe, DecimalPipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { Router, RouterLink } from '@angular/router';
import { ChunkOut, DocumentDetail, IngestionJobOut } from '../../core/api/models';
import { DocumentsService } from '../../core/api/services';
import { NotificationService } from '../../core/errors/notification.service';
import { AppError } from '../../core/http/app-error';
import { injectApiV1 } from '../../core/http/api-url';
import { activeLocale } from '../../core/i18n/locale';
import { formatNumber } from '../../core/i18n/plural';
import { RelativeTimePipe } from '../../shared/pipes/relative-time.pipe';
import { ConfirmService } from '../../shared/ui/confirm-dialog';
import { StatusBadge } from '../../shared/ui/status-badge';
import { CollectionContext } from './collection-context';
import { describeStats, DocumentsStore, IngestionStats } from './documents.store';
import { mimeLabel } from './documents-tab';

export function jobDuration(job: IngestionJobOut): string {
  if (!job.started_at || !job.finished_at) return '';
  const ms = new Date(job.finished_at).getTime() - new Date(job.started_at).getTime();
  if (ms < 1000) return $localize`:@@collections.jobs.durationMs:${ms}:ms: ms`;
  const seconds = formatNumber(ms / 1000, activeLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: false });
  return $localize`:@@collections.jobs.durationSeconds:${seconds}:seconds: s`;
}

export function jobKindLabel(kind: string): string {
  switch (kind) {
    case 'ingest':
      return $localize`:@@collections.jobs.kindIngest:ingest`;
    case 'sync':
      return $localize`:@@collections.jobs.kindSync:sync`;
    default:
      return kind;
  }
}

@Component({
  selector: 'kb-document-detail',
  imports: [RouterLink, DatePipe, DecimalPipe, MatButtonModule, MatIconModule, MatProgressBarModule, MatTableModule, StatusBadge, RelativeTimePipe],
  templateUrl: './document-detail.html',
  styleUrl: './document-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentDetailPage {
  private readonly api = injectApiV1();
  private readonly documents = inject(DocumentsService);
  private readonly store = inject(DocumentsStore);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  private readonly notify = inject(NotificationService);
  protected readonly context = inject(CollectionContext);

  readonly documentId = input.required<string>();
  readonly collectionId = input.required<string>();

  protected readonly detail = httpResource<DocumentDetail>(() => this.api(`/documents/${this.documentId()}`));
  protected readonly chunks = signal<ChunkOut[]>([]);
  protected readonly nextCursor = signal<string | null>(null);
  protected readonly chunksLoading = signal(false);
  protected readonly jobColumns = ['kind', 'status', 'started', 'duration', 'stats'];
  protected readonly mimeLabel = mimeLabel;

  protected readonly liveStatus = computed(() => {
    const live = this.store.documents().find((d) => d.id === this.documentId());
    return live?.status ?? this.detail.value()?.status ?? null;
  });
  protected readonly lastStats = computed<IngestionStats | null>(() => {
    const live = this.store.stats()[this.documentId()];
    if (live) return live;
    const job = this.detail.value()?.jobs.find((j) => j.stats);
    return (job?.stats as IngestionStats | undefined) ?? null;
  });
  protected readonly statsText = computed(
    () => describeStats(this.lastStats()) || $localize`:@@collections.docDetail.noStats:No ingestion statistics yet`,
  );

  constructor() {
    effect(() => {
      const id = this.documentId();
      untracked(() => {
        this.chunks.set([]);
        this.nextCursor.set(null);
        this.loadChunks(id, null);
      });
    });
    let previous: string | null = null;
    effect(() => {
      const status = this.liveStatus();
      if (previous && previous !== status && (status === 'ready' || status === 'failed')) {
        untracked(() => {
          this.detail.reload();
          this.chunks.set([]);
          this.loadChunks(this.documentId(), null);
        });
      }
      previous = status;
    });
  }

  protected statsOf(job: IngestionJobOut): string {
    return describeStats(job.stats as IngestionStats | null);
  }

  protected jobDuration = jobDuration;
  protected readonly jobKindLabel = jobKindLabel;

  protected loadChunks(documentId: string, cursor: string | null): void {
    this.chunksLoading.set(true);
    this.documents.listDocumentChunks({ document_id: documentId, cursor, limit: 50 }).subscribe({
      next: (page) => {
        this.chunks.update((list) => [...list, ...page.items]);
        this.nextCursor.set(page.next_cursor ?? null);
        this.chunksLoading.set(false);
      },
      error: (error: unknown) => {
        this.chunksLoading.set(false);
        this.notify.error(AppError.from(error).userMessage);
      },
    });
  }

  protected loadMore(): void {
    this.loadChunks(this.documentId(), this.nextCursor());
  }

  protected async reindex(): Promise<void> {
    if (await this.store.reindex(this.documentId())) {
      this.notify.info($localize`:@@collections.docDetail.reindexStarted:Re-indexing started`);
      this.detail.reload();
    }
  }

  protected remove(): void {
    const title = this.detail.value()?.title;
    this.confirm
      .confirm({
        title: $localize`:@@collections.documents.deleteTitle:Delete document?`,
        message: title
          ? $localize`:@@collections.documents.deleteMessage:“${title}:title:” and all its chunks will be removed.`
          : $localize`:@@collections.docDetail.deleteMessageUntitled:This document and all its chunks will be removed.`,
        confirmText: $localize`:@@common.delete:Delete`,
        destructive: true,
      })
      .subscribe(async (ok) => {
        if (ok && (await this.store.remove(this.documentId()))) {
          this.notify.success($localize`:@@collections.documents.deleted:Document deleted`);
          void this.router.navigate(['/collections', this.collectionId(), 'documents']);
        }
      });
  }
}
