import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, untracked } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CollectionOut } from '../../core/api/models';
import { injectApiV1 } from '../../core/http/api-url';
import { CollectionContext } from './collection-context';
import { DocumentsStore } from './documents.store';
import { canEdit, canManage, roleName } from './roles';

@Component({
  selector: 'kb-collection-detail',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatTabsModule, MatButtonModule, MatIconModule, MatProgressBarModule],
  providers: [DocumentsStore, CollectionContext],
  template: `
    <div class="kb-page">
      <header class="kb-page-header">
        <a mat-icon-button routerLink="/collections" aria-label="All collections" i18n-aria-label="@@collections.detail.allCollections">
          <mat-icon>arrow_back</mat-icon>
        </a>
        <div class="title">
          <h1 data-testid="collection-title">{{ title() }}</h1>
          @if (collection.value(); as c) {
            <span class="kb-muted">{{ c.description }}</span>
          }
        </div>
        <span class="kb-spacer"></span>
        @if (collection.value(); as c) {
          <span class="role" data-testid="collection-role" i18n="@@collections.detail.yourRole">Your role: <strong>{{ roleName(c.role) }}</strong></span>
        }
      </header>
      @if (collection.isLoading()) {
        <mat-progress-bar mode="indeterminate" />
      }
      <nav mat-tab-nav-bar [tabPanel]="panel" aria-label="Collection sections" i18n-aria-label="@@collections.detail.sections">
        <a mat-tab-link routerLink="documents" routerLinkActive #docs="routerLinkActive" [active]="docs.isActive" data-testid="tab-documents" i18n="@@collections.detail.tabDocuments">Documents</a>
        @if (editable()) {
          <a mat-tab-link routerLink="sources" routerLinkActive #src="routerLinkActive" [active]="src.isActive" data-testid="tab-sources" i18n="@@collections.detail.tabSources">Sources</a>
        }
        @if (manageable()) {
          <a mat-tab-link routerLink="access" routerLinkActive #acc="routerLinkActive" [active]="acc.isActive" data-testid="tab-access" i18n="@@collections.detail.tabAccess">Access</a>
        }
      </nav>
      <mat-tab-nav-panel #panel class="panel">
        <router-outlet />
      </mat-tab-nav-panel>
    </div>
  `,
  styles: `
    .title {
      display: grid;
    }
    .title h1 {
      margin: 0;
    }
    .role {
      text-transform: none;
    }
    .panel {
      display: block;
      padding-top: 16px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectionDetail {
  private readonly api = injectApiV1();
  private readonly store = inject(DocumentsStore);
  private readonly context = inject(CollectionContext);
  readonly collectionId = input.required<string>();
  protected readonly collection = httpResource<CollectionOut>(() => this.api(`/collections/${this.collectionId()}`));
  protected readonly editable = computed(() => canEdit(this.collection.value()?.role));
  protected readonly manageable = computed(() => canManage(this.collection.value()?.role));
  protected readonly title = computed(() => this.collection.value()?.name ?? $localize`:@@collections.detail.fallbackTitle:Collection`);
  protected readonly roleName = roleName;

  constructor() {
    effect(() => {
      const id = this.collectionId();
      untracked(() => this.store.load(id));
    });
    effect(() => {
      const value = this.collection.value() ?? null;
      untracked(() => this.context.collection.set(value));
    });
    this.store.connectEvents();
  }
}
