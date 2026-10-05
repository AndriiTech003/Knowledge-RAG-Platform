import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FileSizePipe } from '../../shared/pipes/file-size.pipe';
import { UploadItem } from './documents.store';

@Component({
  selector: 'kb-upload-list',
  imports: [MatProgressBarModule, MatIconModule, MatButtonModule, MatTooltipModule, FileSizePipe],
  template: `
    <ul class="uploads" aria-label="Uploads" i18n-aria-label="@@collections.uploads.label" data-testid="upload-list">
      @for (item of items(); track item.id) {
        <li class="upload" [attr.data-status]="item.status" [attr.data-name]="item.name" [attr.data-document-id]="item.documentId" data-testid="upload-item">
          <mat-icon class="upload__icon" aria-hidden="true">{{ icon(item) }}</mat-icon>
          <div class="upload__body">
            <div class="upload__line">
              <span class="upload__name">{{ item.name }}</span>
              <span class="kb-muted">{{ item.size | fileSize }}</span>
              <span class="upload__state" data-testid="upload-state">{{ label(item) }}</span>
            </div>
            @if (item.status === 'uploading' || item.status === 'registering' || item.status === 'queued') {
              <mat-progress-bar
                [mode]="item.status === 'queued' ? 'buffer' : item.status === 'registering' ? 'indeterminate' : 'determinate'"
                [value]="item.progress"
                [attr.aria-label]="progressLabel(item)"
                data-testid="upload-progress"
              />
            }
            @if (item.error) {
              <div class="upload__error" role="alert" data-testid="upload-error">{{ item.error }}</div>
            }
          </div>
          <div class="upload__actions">
            @if (item.status === 'queued' || item.status === 'uploading' || item.status === 'registering') {
              <button mat-icon-button type="button" (click)="cancelled.emit(item.id)" [attr.aria-label]="cancelLabel(item)" data-testid="upload-cancel">
                <mat-icon>close</mat-icon>
              </button>
            }
            @if (item.status === 'error' || item.status === 'cancelled') {
              <button mat-icon-button type="button" (click)="retry.emit(item.id)" [attr.aria-label]="retryLabel(item)" data-testid="upload-retry">
                <mat-icon>refresh</mat-icon>
              </button>
            }
            @if (item.status === 'done' || item.status === 'error' || item.status === 'cancelled') {
              <button mat-icon-button type="button" (click)="dismiss.emit(item.id)" [attr.aria-label]="dismissLabel(item)">
                <mat-icon>delete_sweep</mat-icon>
              </button>
            }
          </div>
        </li>
      }
    </ul>
  `,
  styles: `
    .uploads {
      display: grid;
      gap: 6px;
      margin: 12px 0 0;
      padding: 0;
      list-style: none;
    }
    .upload {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 12px;
      border-radius: 12px;
      background: var(--mat-sys-surface-container-low);
    }
    .upload__body {
      display: grid;
      flex: 1;
      gap: 4px;
      min-width: 0;
    }
    .upload__line {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .upload__name {
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      font-weight: 500;
    }
    .upload__state {
      margin-left: auto;
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
    .upload__error {
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-error);
    }
    [data-status='done'] .upload__icon {
      color: #2e7d32;
    }
    [data-status='error'] .upload__icon {
      color: var(--mat-sys-error);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UploadList {
  readonly items = input.required<UploadItem[]>();
  readonly cancelled = output<string>();
  readonly retry = output<string>();
  readonly dismiss = output<string>();

  protected icon(item: UploadItem): string {
    switch (item.status) {
      case 'done':
        return 'check_circle';
      case 'error':
        return 'error';
      case 'cancelled':
        return 'cancel';
      default:
        return 'upload';
    }
  }

  protected label(item: UploadItem): string {
    switch (item.status) {
      case 'queued':
        return $localize`:@@collections.uploads.waiting:Waiting…`;
      case 'uploading':
        return `${item.progress}%`;
      case 'registering':
        return $localize`:@@collections.uploads.registering:Registering…`;
      case 'done':
        return item.newVersion
          ? $localize`:@@collections.uploads.uploadedNewVersion:Uploaded · new version`
          : $localize`:@@collections.uploads.uploaded:Uploaded`;
      case 'error':
        return $localize`:@@collections.uploads.failed:Failed`;
      case 'cancelled':
        return $localize`:@@collections.uploads.cancelled:Cancelled`;
    }
  }

  protected progressLabel(item: UploadItem): string {
    return $localize`:@@collections.uploads.progressLabel:Upload progress for ${item.name}:name:`;
  }

  protected cancelLabel(item: UploadItem): string {
    return $localize`:@@collections.uploads.cancelLabel:Cancel ${item.name}:name:`;
  }

  protected retryLabel(item: UploadItem): string {
    return $localize`:@@collections.uploads.retryLabel:Retry ${item.name}:name:`;
  }

  protected dismissLabel(item: UploadItem): string {
    return $localize`:@@collections.uploads.dismissLabel:Dismiss ${item.name}:name:`;
  }
}
