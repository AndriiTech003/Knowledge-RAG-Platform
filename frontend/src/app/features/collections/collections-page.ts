import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { PageCollectionOut } from '../../core/api/models';
import { CurrentUserStore } from '../../core/auth/current-user.store';
import { injectApiV1 } from '../../core/http/api-url';
import { EmptyState } from '../../shared/ui/empty-state';
import { CreateCollectionDialog } from './create-collection-dialog';
import { roleName } from './roles';

@Component({
  selector: 'kb-collections-page',
  imports: [RouterLink, MatButtonModule, MatIconModule, MatProgressBarModule, EmptyState],
  template: `
    <div class="kb-page">
      <header class="kb-page-header">
        <h1 i18n="@@collections.page.title">Collections</h1>
        <span class="kb-spacer"></span>
        @if (user.isAdmin()) {
          <button mat-flat-button type="button" (click)="create()" data-testid="create-collection">
            <mat-icon>add</mat-icon>
            <span i18n="@@collections.page.newCollection">New collection</span>
          </button>
        }
      </header>
      @if (collections.isLoading()) {
        <mat-progress-bar mode="indeterminate" />
      }
      @if (collections.error()) {
        <kb-empty-state
          icon="error"
          title="Could not load collections"
          i18n-title="@@collections.page.loadError"
          message="Please try again."
          i18n-message="@@collections.page.loadErrorHint"
        >
          <button mat-button type="button" (click)="collections.reload()" i18n="@@common.retry">Retry</button>
        </kb-empty-state>
      }
      <div class="kb-grid">
        @for (collection of collections.value()?.items ?? []; track collection.id) {
          <a class="card kb-card" [routerLink]="['/collections', collection.id]" data-testid="collection-card" [attr.data-name]="collection.name">
            <div class="card__head">
              <mat-icon aria-hidden="true">folder</mat-icon>
              <h2>{{ collection.name }}</h2>
            </div>
            <p class="card__desc">{{ collection.description || noDescription }}</p>
            <div class="card__meta">
              @let docCount = collection.document_count ?? 0;
              @let readyCount = collection.ready_count ?? 0;
              <span class="card__count" data-testid="collection-doc-count" i18n="@@collections.page.docCount">{docCount, plural, one {{{ docCount }} document} other {{{ docCount }} documents}}</span>
              @if (readyCount < docCount) {
                <span class="kb-muted" i18n="@@collections.page.processing">· {{ docCount - readyCount }} processing</span>
              }
              <span class="card__role" [attr.data-role]="collection.role" data-testid="collection-role">{{ roleName(collection.role) }}</span>
            </div>
          </a>
        } @empty {
          @if (!collections.isLoading() && !collections.error()) {
            <kb-empty-state
              icon="folder_off"
              title="No collections"
              i18n-title="@@collections.page.emptyTitle"
              message="You do not have access to any collection yet."
              i18n-message="@@collections.page.emptyMessage"
            />
          }
        }
      </div>
    </div>
  `,
  styles: `
    .card {
      display: grid;
      gap: 8px;
      color: inherit;
      text-decoration: none;
      transition: box-shadow 120ms ease, border-color 120ms ease;
    }
    .card:hover,
    .card:focus-visible {
      border-color: var(--mat-sys-primary);
      box-shadow: var(--mat-sys-level2);
      outline: none;
    }
    .card__head {
      display: flex;
      align-items: center;
      gap: 10px;
      color: var(--mat-sys-primary);
    }
    h2 {
      margin: 0;
      font: var(--mat-sys-title-medium);
      color: var(--mat-sys-on-surface);
    }
    .card__desc {
      margin: 0;
      min-height: 40px;
      color: var(--mat-sys-on-surface-variant);
    }
    .card__meta {
      display: flex;
      align-items: center;
      gap: 6px;
      font: var(--mat-sys-body-small);
    }
    .card__role {
      margin-left: auto;
      padding: 2px 10px;
      border-radius: 999px;
      background: var(--mat-sys-tertiary-container);
      color: var(--mat-sys-on-tertiary-container);
      text-transform: capitalize;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectionsPage {
  private readonly api = injectApiV1();
  private readonly dialog = inject(MatDialog);
  protected readonly user = inject(CurrentUserStore);
  protected readonly noDescription = $localize`:@@collections.page.noDescription:No description`;
  protected readonly roleName = roleName;
  protected readonly collections = httpResource<PageCollectionOut>(() => ({ url: this.api('/collections'), params: { limit: 200 } }));

  protected create(): void {
    this.dialog
      .open(CreateCollectionDialog, { width: '560px' })
      .afterClosed()
      .subscribe((created) => {
        if (created) {
          this.collections.reload();
          void this.user.reload();
        }
      });
  }
}
