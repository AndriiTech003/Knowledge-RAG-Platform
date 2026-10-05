import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, input, numberAttribute } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { DocumentDetail } from '../../core/api/models';
import { injectApiV1 } from '../../core/http/api-url';
import { DocumentViewer } from './document-viewer';

@Component({
  selector: 'kb-document-viewer-page',
  imports: [DocumentViewer, MatButtonModule, MatIconModule, RouterLink],
  template: `
    <div class="page">
      <header class="kb-page-header">
        @if (doc.value(); as d) {
          <a mat-icon-button [routerLink]="['/collections', d.collection_id, 'documents', d.id]" aria-label="Document details" i18n-aria-label="@@viewer.page.back">
            <mat-icon>arrow_back</mat-icon>
          </a>
          <h1>{{ d.title }}</h1>
        } @else {
          <h1 i18n="@@viewer.page.title">Document</h1>
        }
      </header>
      <kb-document-viewer class="page__viewer" [documentId]="documentId()" [page]="pageNumber()" [chunkId]="chunk() ?? null" />
    </div>
  `,
  styles: `
    .page {
      display: flex;
      flex-direction: column;
      height: 100%;
      padding: 16px 24px;
    }
    .kb-page-header h1 {
      margin: 0;
    }
    .page__viewer {
      flex: 1;
      min-height: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentViewerPage {
  private readonly api = injectApiV1();
  readonly documentId = input.required<string>();
  readonly page = input<number | undefined, unknown>(undefined, { transform: (v: unknown) => (v === undefined || v === null || v === '' ? undefined : numberAttribute(v)) });
  readonly chunk = input<string | undefined>(undefined);
  protected readonly pageNumber = computed(() => this.page() ?? null);
  protected readonly doc = httpResource<DocumentDetail>(() => this.api(`/documents/${this.documentId()}`));
}
