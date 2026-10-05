import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'kb-empty-state',
  imports: [MatIconModule],
  template: `
    <div class="empty" [attr.data-testid]="testId()">
      <mat-icon aria-hidden="true">{{ icon() }}</mat-icon>
      <h2>{{ title() }}</h2>
      @if (message()) {
        <p>{{ message() }}</p>
      }
      <ng-content />
    </div>
  `,
  styles: `
    .empty {
      display: grid;
      justify-items: center;
      gap: 6px;
      padding: 40px 16px;
      text-align: center;
      color: var(--mat-sys-on-surface-variant);
    }
    mat-icon {
      width: 40px;
      height: 40px;
      font-size: 40px;
      color: var(--mat-sys-primary);
    }
    h2 {
      margin: 4px 0 0;
      font: var(--mat-sys-title-medium);
      color: var(--mat-sys-on-surface);
    }
    p {
      margin: 0;
      max-width: 460px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyState {
  readonly icon = input('inbox');
  readonly title = input.required<string>();
  readonly message = input<string | null>(null);
  readonly testId = input('empty-state');
}
