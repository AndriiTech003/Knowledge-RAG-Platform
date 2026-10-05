import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { map, startWith } from 'rxjs';
import { SearchHit } from '../../core/api/models';
import { SearchService } from '../../core/api/services';
import { CurrentUserStore } from '../../core/auth/current-user.store';
import { activeLocale } from '../../core/i18n/locale';
import { formatNumber, plural } from '../../core/i18n/plural';
import { EmptyState } from '../../shared/ui/empty-state';
import { IDLE_SEARCH, SearchMode, SearchParams, searchPipeline } from './search-query';

@Component({
  selector: 'kb-search-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    DecimalPipe,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonToggleModule,
    MatSlideToggleModule,
    MatSelectModule,
    MatProgressBarModule,
    MatTooltipModule,
    EmptyState,
  ],
  templateUrl: './search-page.html',
  styleUrl: './search-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchPage {
  private readonly api = inject(SearchService);
  protected readonly user = inject(CurrentUserStore);
  readonly q = input<string | undefined>(undefined);

  protected readonly form = new FormGroup({
    query: new FormControl('', { nonNullable: true }),
    mode: new FormControl<SearchMode>('hybrid', { nonNullable: true }),
    rerank: new FormControl(true, { nonNullable: true }),
    collections: new FormControl<string[]>([], { nonNullable: true }),
    k: new FormControl(10, { nonNullable: true }),
  });

  private readonly params$ = this.form.valueChanges.pipe(
    startWith(this.form.getRawValue()),
    map((): SearchParams => this.form.getRawValue()),
  );
  protected readonly state = toSignal(searchPipeline(this.params$, (request) => this.api.search({ body: request })), {
    initialValue: IDLE_SEARCH,
  });
  protected readonly results = computed(() => this.state().response?.results ?? []);
  protected readonly timings = computed(() => Object.entries(this.state().response?.timings_ms ?? {}));
  protected readonly summary = computed(() => {
    const response = this.state().response;
    if (!response) return '';
    const results = plural(response.results.length, {
      one: $localize`:@@search.summary.resultsOne:{count} result`,
      few: $localize`:@@search.summary.resultsFew:{count} results`,
      many: $localize`:@@search.summary.resultsMany:{count} results`,
      other: $localize`:@@search.summary.resultsOther:{count} results`,
    });
    const candidates = plural(response.candidates, {
      one: $localize`:@@search.summary.candidatesOne:from {count} candidate`,
      few: $localize`:@@search.summary.candidatesFew:from {count} candidates`,
      many: $localize`:@@search.summary.candidatesMany:from {count} candidates`,
      other: $localize`:@@search.summary.candidatesOther:from {count} candidates`,
    });
    const mode = this.modeLabel(response.mode);
    return response.rerank
      ? $localize`:@@search.summary.withRerank:${results}:results: ${candidates}:candidates: · ${mode}:mode: + rerank`
      : $localize`:@@search.summary.text:${results}:results: ${candidates}:candidates: · ${mode}:mode:`;
  });

  constructor() {
    queueMicrotask(() => {
      const initial = this.q();
      if (initial) this.form.controls.query.setValue(initial);
    });
  }

  protected modeLabel(mode: string): string {
    switch (mode) {
      case 'vector':
        return $localize`:@@search.mode.vector:vector`;
      case 'lexical':
        return $localize`:@@search.mode.lexical:lexical`;
      case 'hybrid':
        return $localize`:@@search.mode.hybrid:hybrid`;
      default:
        return mode;
    }
  }

  protected scoreTip(hit: SearchHit): string {
    const s = hit.scores;
    const fixed = (value: number | null | undefined, digits: number): string =>
      value === null || value === undefined ? '—' : formatNumber(value, activeLocale(), { minimumFractionDigits: digits, maximumFractionDigits: digits });
    const vectorRank = s.vector_rank ?? '—';
    const vectorScore = fixed(s.vector_score, 3);
    const lexicalRank = s.lexical_rank ?? '—';
    const lexicalScore = fixed(s.lexical_score, 3);
    const rrf = fixed(s.rrf, 4);
    const rerank = fixed(s.rerank, 3);
    return $localize`:@@search.score.tip:vector rank ${vectorRank}:vectorRank: (${vectorScore}:vectorScore:) · lexical rank ${lexicalRank}:lexicalRank: (${lexicalScore}:lexicalScore:) · RRF ${rrf}:rrf: · rerank ${rerank}:rerank:`;
  }
}
