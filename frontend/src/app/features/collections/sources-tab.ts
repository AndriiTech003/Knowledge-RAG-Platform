import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, resource, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { firstValueFrom } from 'rxjs';
import { SourceCreate, SourceOut, SyncJobOut } from '../../core/api/models';
import { SourcesService } from '../../core/api/services';
import { NotificationService } from '../../core/errors/notification.service';
import { AppError } from '../../core/http/app-error';
import { RelativeTimePipe } from '../../shared/pipes/relative-time.pipe';
import { ConfirmService } from '../../shared/ui/confirm-dialog';
import { EmptyState } from '../../shared/ui/empty-state';
import { StatusBadge } from '../../shared/ui/status-badge';
import { SourceFormComponent } from './source-form';

export function syncStatLabel(key: string): string {
  switch (key) {
    case 'fetched':
      return $localize`:@@collections.sources.statFetched:fetched`;
    case 'created':
      return $localize`:@@collections.sources.statCreated:created`;
    case 'updated':
      return $localize`:@@collections.sources.statUpdated:updated`;
    case 'unchanged':
      return $localize`:@@collections.sources.statUnchanged:unchanged`;
    case 'deleted':
      return $localize`:@@collections.sources.statDeleted:deleted`;
    case 'errors':
      return $localize`:@@collections.sources.statErrors:errors`;
    default:
      return key.replace(/_/g, ' ');
  }
}

@Component({
  selector: 'kb-sources-tab',
  imports: [DatePipe, MatButtonModule, MatIconModule, MatExpansionModule, MatProgressBarModule, MatTableModule, StatusBadge, EmptyState, RelativeTimePipe, SourceFormComponent],
  templateUrl: './sources-tab.html',
  styleUrl: './sources-tab.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SourcesTab {
  private readonly api = inject(SourcesService);
  private readonly notify = inject(NotificationService);
  private readonly confirm = inject(ConfirmService);

  readonly collectionId = input.required<string>();
  protected readonly sources = resource({
    params: () => ({ id: this.collectionId() }),
    loader: ({ params }) => firstValueFrom(this.api.listSources({ collection_id: params.id })),
  });
  protected readonly editing = signal<SourceOut | 'new' | null>(null);
  protected readonly editingSource = computed(() => {
    const value = this.editing();
    return value && value !== 'new' ? value : null;
  });
  protected readonly saving = signal(false);
  protected readonly history = signal<Record<string, SyncJobOut[]>>({});
  protected readonly jobColumns = ['status', 'started', 'finished', 'stats'];

  protected describe(source: SourceOut): string {
    const config = source.config as Record<string, unknown>;
    if (source.kind === 'web') return String(config['startUrl'] ?? '');
    const databaseId = config['databaseId'];
    return databaseId
      ? $localize`:@@collections.sources.notionDatabase:Notion database ${String(databaseId)}:databaseId:`
      : $localize`:@@collections.sources.notionWorkspace:Notion workspace`;
  }

  protected statsText(job: SyncJobOut): string {
    if (job.error) return job.error;
    const stats = (job.stats ?? {}) as Record<string, unknown>;
    return Object.entries(stats)
      .filter(([, v]) => typeof v === 'number' || typeof v === 'string')
      .map(([k, v]) => `${syncStatLabel(k)}: ${String(v)}`)
      .join(' · ');
  }

  protected async save(payload: SourceCreate): Promise<void> {
    const editing = this.editing();
    this.saving.set(true);
    try {
      if (editing && editing !== 'new') {
        await firstValueFrom(
          this.api.updateSource({ collection_id: this.collectionId(), source_id: editing.id, body: { config: payload.config, schedule: payload.schedule ?? null } }),
        );
        this.notify.success($localize`:@@collections.sources.updated:Source updated`);
      } else {
        await firstValueFrom(this.api.createSource({ collection_id: this.collectionId(), body: payload }));
        this.notify.success($localize`:@@collections.sources.created:Source created`);
      }
      this.editing.set(null);
      this.sources.reload();
    } catch (error) {
      this.notify.error(AppError.from(error).userMessage);
    } finally {
      this.saving.set(false);
    }
  }

  protected async sync(source: SourceOut): Promise<void> {
    try {
      await firstValueFrom(this.api.syncSource({ source_id: source.id }));
      this.notify.info($localize`:@@collections.sources.syncStarted:Sync started`);
      this.sources.reload();
      await this.loadHistory(source);
    } catch (error) {
      this.notify.error(AppError.from(error).userMessage);
    }
  }

  protected remove(source: SourceOut): void {
    this.confirm
      .confirm({
        title: $localize`:@@collections.sources.deleteTitle:Delete source?`,
        message: $localize`:@@collections.sources.deleteMessage:Synchronisation stops; already imported documents stay in the collection.`,
        confirmText: $localize`:@@common.delete:Delete`,
        destructive: true,
      })
      .subscribe(async (ok) => {
        if (!ok) return;
        try {
          await firstValueFrom(this.api.deleteSource({ collection_id: this.collectionId(), source_id: source.id }));
          this.notify.success($localize`:@@collections.sources.deleted:Source deleted`);
          this.sources.reload();
        } catch (error) {
          this.notify.error(AppError.from(error).userMessage);
        }
      });
  }

  protected async loadHistory(source: SourceOut): Promise<void> {
    try {
      const jobs = await firstValueFrom(this.api.listSourceJobs({ source_id: source.id }));
      this.history.update((h) => ({ ...h, [source.id]: jobs }));
    } catch (error) {
      this.notify.error(AppError.from(error).userMessage);
    }
  }
}
