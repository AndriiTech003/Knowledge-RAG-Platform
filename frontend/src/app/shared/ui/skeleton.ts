import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'kb-skeleton',
  template: `
    <div class="skeleton" aria-busy="true" aria-label="Loading" i18n-aria-label="@@ui.skeleton.loading" role="progressbar">
      @for (line of lineArray(); track $index) {
        <span class="skeleton__line" [style.width.%]="line"></span>
      }
    </div>
  `,
  styles: `
    .skeleton {
      display: grid;
      gap: 10px;
      padding: 8px 0;
    }
    .skeleton__line {
      display: block;
      height: 12px;
      border-radius: 6px;
      background: linear-gradient(90deg, var(--mat-sys-surface-container-high), var(--mat-sys-surface-container-highest), var(--mat-sys-surface-container-high));
      background-size: 200% 100%;
      animation: shimmer 1.4s linear infinite;
    }
    @keyframes shimmer {
      from { background-position: 200% 0; }
      to { background-position: -200% 0; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Skeleton {
  readonly lines = input(3);
  protected readonly lineArray = computed(() => Array.from({ length: this.lines() }, (_, i) => (i % 3 === 2 ? 60 : 92 - i * 4)));
}
