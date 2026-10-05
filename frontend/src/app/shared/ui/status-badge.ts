import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export const IN_PROGRESS_STATUSES = new Set(['queued', 'parsing', 'chunking', 'embedding', 'running', 'syncing', 'pending']);

export function statusLabel(status: string): string {
  switch (status) {
    case 'queued':
      return $localize`:@@ui.status.queued:Queued`;
    case 'parsing':
      return $localize`:@@ui.status.parsing:Parsing`;
    case 'chunking':
      return $localize`:@@ui.status.chunking:Chunking`;
    case 'embedding':
      return $localize`:@@ui.status.embedding:Embedding`;
    case 'ready':
      return $localize`:@@ui.status.ready:Ready`;
    case 'failed':
      return $localize`:@@ui.status.failed:Failed`;
    case 'deleted':
      return $localize`:@@ui.status.deleted:Deleted`;
    case 'running':
      return $localize`:@@ui.status.running:Running`;
    case 'done':
      return $localize`:@@ui.status.done:Done`;
    case 'syncing':
      return $localize`:@@ui.status.syncing:Syncing`;
    case 'idle':
      return $localize`:@@ui.status.idle:Idle`;
    case 'error':
      return $localize`:@@ui.status.error:Error`;
    case 'pending':
      return $localize`:@@ui.status.pending:Pending`;
    case 'complete':
      return $localize`:@@ui.status.complete:Complete`;
    case 'unknown':
      return $localize`:@@ui.status.unknown:Unknown`;
    default:
      return status;
  }
}

@Component({
  selector: 'kb-status-badge',
  template: `
    <span
      class="badge"
      [class]="'badge badge--' + tone()"
      [class.badge--active]="active()"
      [attr.data-status]="status()"
      data-testid="status-badge"
      role="status"
    >
      @if (active()) {
        <span class="badge__pulse" aria-hidden="true"></span>
      }
      {{ label() }}
    </span>
  `,
  styles: `
    :host {
      display: inline-flex;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 2px 10px;
      border-radius: 999px;
      font: var(--mat-sys-label-medium);
      background: var(--mat-sys-surface-container-highest);
      color: var(--mat-sys-on-surface-variant);
      white-space: nowrap;
    }
    .badge--ok {
      background: color-mix(in srgb, #2e7d32 18%, transparent);
      color: light-dark(#1b5e20, #a5d6a7);
    }
    .badge--error {
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }
    .badge--progress {
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
    }
    .badge__pulse {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: currentColor;
      animation: pulse 1.1s ease-in-out infinite;
    }
    .badge--active {
      background-image: linear-gradient(90deg, transparent, color-mix(in srgb, currentColor 14%, transparent), transparent);
      background-size: 200% 100%;
      animation: shimmer 1.6s linear infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 0.35; transform: scale(0.8); }
      50% { opacity: 1; transform: scale(1.15); }
    }
    @keyframes shimmer {
      from { background-position: 200% 0; }
      to { background-position: -200% 0; }
    }
    @media (prefers-reduced-motion: reduce) {
      .badge__pulse, .badge--active { animation: none; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusBadge {
  readonly status = input.required<string | null | undefined>();
  protected readonly active = computed(() => IN_PROGRESS_STATUSES.has(this.status() ?? ''));
  protected readonly label = computed(() => {
    return statusLabel(this.status() ?? 'unknown');
  });
  protected readonly tone = computed(() => {
    const status = this.status() ?? '';
    if (status === 'ready' || status === 'done' || status === 'complete') return 'ok';
    if (status === 'failed' || status === 'error') return 'error';
    if (IN_PROGRESS_STATUSES.has(status)) return 'progress';
    return 'neutral';
  });
}
