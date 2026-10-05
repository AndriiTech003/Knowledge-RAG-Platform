import { ChangeDetectionStrategy, Component, computed, effect, inject, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { DocumentOut } from '../../core/api/models';
import { NotificationService } from '../../core/errors/notification.service';
import { RelativeTimePipe } from '../../shared/pipes/relative-time.pipe';
import { ConfirmService } from '../../shared/ui/confirm-dialog';
import { EmptyState } from '../../shared/ui/empty-state';
import { FileDropZone } from '../../shared/ui/file-drop-zone';
import { StatusBadge } from '../../shared/ui/status-badge';
import { CollectionContext } from './collection-context';
import { describeStats, DocumentsStore } from './documents.store';
import { UploadList } from './upload-list';

export const DOCUMENT_STATUSES = ['queued', 'parsing', 'chunking', 'embedding', 'ready', 'failed'];

export function mimeLabel(mime: string): string {
  if (!mime) return '—';
  if (mime.includes('pdf')) return 'PDF';
  if (mime.includes('wordprocessingml')) return 'DOCX';
  if (mime.includes('markdown')) return 'Markdown';
  if (mime.includes('html')) return 'HTML';
  if (mime.startsWith('text/')) return $localize`:@@collections.documents.mimeText:Text`;
  return mime;
}

export function documentStatusLabel(status: string): string {
  switch (status) {
    case 'queued':
      return $localize`:@@collections.documents.statusQueued:queued`;
    case 'parsing':
      return $localize`:@@collections.documents.statusParsing:parsing`;
    case 'chunking':
      return $localize`:@@collections.documents.statusChunking:chunking`;
    case 'embedding':
      return $localize`:@@collections.documents.statusEmbedding:embedding`;
    case 'ready':
      return $localize`:@@collections.documents.statusReady:ready`;
    case 'failed':
      return $localize`:@@collections.documents.statusFailed:failed`;
    default:
      return status;
  }
}

@Component({
  selector: 'kb-documents-tab',
  imports: [
    RouterLink,
    MatTableModule,
    MatSortModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    MatProgressBarModule,
    StatusBadge,
    FileDropZone,
    UploadList,
    EmptyState,
    RelativeTimePipe,
  ],
  templateUrl: './documents-tab.html',
  styleUrl: './documents-tab.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentsTab {
  protected readonly store = inject(DocumentsStore);
  protected readonly context = inject(CollectionContext);
  private readonly confirm = inject(ConfirmService);
  private readonly notify = inject(NotificationService);

  protected readonly columns = ['title', 'status', 'mime_type', 'page_count', 'updated_at', 'actions'];
  protected readonly statuses = DOCUMENT_STATUSES;
  protected readonly dataSource = new MatTableDataSource<DocumentOut>([]);
  protected readonly sort = viewChild(MatSort);
  protected readonly mimeLabel = mimeLabel;
  protected readonly describeStats = describeStats;
  protected readonly statusLabel = documentStatusLabel;
  protected readonly emptyMessage = computed(() =>
    this.store.documents().length
      ? $localize`:@@collections.documents.emptyFiltered:No documents match the filter.`
      : $localize`:@@collections.documents.emptyHint:Upload files to get started.`,
  );

  constructor() {
    this.dataSource.sortingDataAccessor = (doc, column) => {
      switch (column) {
        case 'updated_at':
          return new Date(doc.updated_at).getTime();
        case 'page_count':
          return doc.page_count ?? 0;
        case 'title':
          return doc.title.toLowerCase();
        default:
          return String((doc as unknown as Record<string, unknown>)[column] ?? '');
      }
    };
    effect(() => {
      this.dataSource.data = this.store.filtered();
    });
    effect(() => {
      const sort = this.sort();
      if (sort) this.dataSource.sort = sort;
    });
  }

  protected onFiles(files: File[]): void {
    this.store.addFiles(files);
  }

  protected onQuery(event: Event): void {
    this.store.setQuery((event.target as HTMLInputElement).value);
  }

  protected async reindex(doc: DocumentOut): Promise<void> {
    if (await this.store.reindex(doc.id)) this.notify.info($localize`:@@collections.documents.reindexing:Re-indexing “${doc.title}:title:”`);
  }

  protected remove(doc: DocumentOut): void {
    this.confirm
      .confirm({
        title: $localize`:@@collections.documents.deleteTitle:Delete document?`,
        message: $localize`:@@collections.documents.deleteMessage:“${doc.title}:title:” and all its chunks will be removed.`,
        confirmText: $localize`:@@common.delete:Delete`,
        destructive: true,
      })
      .subscribe(async (ok) => {
        if (ok && (await this.store.remove(doc.id))) this.notify.success($localize`:@@collections.documents.deleted:Document deleted`);
      });
  }
}
