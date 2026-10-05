import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { CollectionRefLite, NoAnswerEventData } from './chat.models';

@Component({
  selector: 'kb-no-answer-card',
  imports: [MatIconModule],
  template: `
    <section class="card" role="note" data-testid="no-answer-card">
      <mat-icon aria-hidden="true">search_off</mat-icon>
      <div>
        <h3>{{ heading() }}</h3>
        <p>{{ body() }}</p>
        @if (collections().length) {
          <p class="searched" data-testid="no-answer-collections">
            <span i18n="@@chat.noAnswer.searchedIn">Searched in:</span>&nbsp;
            @for (collection of collections(); track collection.id; let last = $last) {
              <strong>{{ collection.name }}</strong>{{ last ? '' : ', ' }}
            }
          </p>
        }
        @if (info()?.best_score !== null && info()?.best_score !== undefined) {
          <p class="score" i18n="@@chat.noAnswer.bestScore">Best relevance score: {{ info()?.best_score }}</p>
        }
      </div>
    </section>
  `,
  styles: `
    .card {
      display: flex;
      gap: 14px;
      padding: 16px;
      border-radius: 16px;
      border: 1px dashed var(--mat-sys-outline);
      background: var(--mat-sys-surface-container);
    }
    mat-icon {
      color: var(--mat-sys-tertiary);
    }
    h3 {
      margin: 0 0 4px;
      font: var(--mat-sys-title-small);
    }
    p {
      margin: 4px 0 0;
    }
    .searched,
    .score {
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NoAnswerCard {
  readonly info = input<NoAnswerEventData | null>(null);
  readonly collections = input<CollectionRefLite[]>([]);
  readonly heading = computed(() =>
    this.info()?.reason === 'no_access'
      ? $localize`:@@chat.noAnswer.noAccessTitle:No accessible collections`
      : $localize`:@@chat.noAnswer.notFoundTitle:Not found in the documents available to you`,
  );
  readonly body = computed(() =>
    this.info()?.reason === 'no_access'
      ? $localize`:@@chat.noAnswer.noAccessBody:You do not have access to any collection that could answer this. Ask an owner for access.`
      : $localize`:@@chat.noAnswer.notFoundBody:I could not find a reliable answer in the knowledge base. Try rephrasing, or ask the content team to add a document.`,
  );
}
