import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, input, output, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { Skeleton } from '../../shared/ui/skeleton';
import { DocumentViewer } from '../document-viewer/document-viewer';
import { SourceRow } from './chat.models';

@Component({
  selector: 'kb-sources-panel',
  imports: [DecimalPipe, MatButtonModule, MatIconModule, MatTooltipModule, RouterLink, DocumentViewer, Skeleton],
  templateUrl: './sources-panel.html',
  styleUrl: './sources-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(keydown)': 'onKeydown($event)',
  },
})
export class SourcesPanel {
  readonly sources = input.required<SourceRow[]>();
  readonly selected = input<SourceRow | null>(null);
  readonly sourceSelected = output<number>();
  readonly closed = output<void>();
  private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');

  constructor() {
    afterNextRender(() => this.heading()?.nativeElement.focus());
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.stopPropagation();
      this.closed.emit();
    }
  }
}
