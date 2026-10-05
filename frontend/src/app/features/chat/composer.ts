import { CdkTextareaAutosize } from '@angular/cdk/text-field';
import { ChangeDetectionStrategy, Component, ElementRef, computed, input, model, output, signal, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MeCollection } from '../../core/api/models';

@Component({
  selector: 'kb-composer',
  imports: [CdkTextareaAutosize, MatButtonModule, MatIconModule, MatSelectModule, MatFormFieldModule, MatTooltipModule],
  template: `
    <form class="composer" (submit)="$event.preventDefault(); submit()">
      <textarea
        #box
        class="composer__input"
        cdkTextareaAutosize
        cdkAutosizeMinRows="1"
        cdkAutosizeMaxRows="10"
        [value]="text()"
        (input)="text.set(box.value)"
        (keydown)="onKeydown($event)"
        placeholder="Ask a question about your documents…"
        i18n-placeholder="@@chat.composer.placeholder"
        aria-label="Message"
        i18n-aria-label="@@chat.composer.messageLabel"
        aria-describedby="composer-hint"
        data-testid="composer-input"
      ></textarea>
      <div class="composer__bar">
        <mat-form-field class="composer__collections" subscriptSizing="dynamic" appearance="outline">
          <mat-select
            multiple
            placeholder="All my collections"
            i18n-placeholder="@@chat.composer.allCollections"
            aria-label="Limit search to collections"
            i18n-aria-label="@@chat.composer.collectionsLabel"
            [value]="selectedCollections()"
            (valueChange)="selectedCollections.set($event)"
            data-testid="composer-collections"
          >
            @for (collection of collections(); track collection.id) {
              <mat-option [value]="collection.id">{{ collection.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <span id="composer-hint" class="composer__hint" i18n="@@chat.composer.hint">Enter to send · Shift+Enter for a new line</span>
        @if (streaming()) {
          <button mat-stroked-button type="button" (click)="stopped.emit()" data-testid="stop-button">
            <mat-icon>stop_circle</mat-icon>
            <span i18n="@@chat.composer.stop">Stop</span>
          </button>
        } @else {
          <button mat-flat-button type="submit" [disabled]="!canSend()" data-testid="send-button">
            <mat-icon>send</mat-icon>
            <span i18n="@@chat.composer.send">Send</span>
          </button>
        }
      </div>
    </form>
  `,
  styles: `
    .composer {
      display: grid;
      gap: 8px;
      padding: 12px 14px 10px;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 20px;
      background: var(--mat-sys-surface-container-low);
    }
    .composer:focus-within {
      border-color: var(--mat-sys-primary);
    }
    .composer__input {
      width: 100%;
      resize: none;
      border: 0;
      outline: none;
      background: transparent;
      color: var(--mat-sys-on-surface);
      font: var(--mat-sys-body-large);
    }
    .composer__bar {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .composer__collections {
      width: 240px;
      --mat-form-field-container-height: 40px;
      --mat-form-field-container-vertical-padding: 8px;
    }
    .composer__hint {
      flex: 1;
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Composer {
  readonly streaming = input(false);
  readonly disabled = input(false);
  readonly collections = input<MeCollection[]>([]);
  readonly selectedCollections = model<string[]>([]);
  readonly sent = output<string>();
  readonly stopped = output<void>();

  protected readonly text = signal('');
  protected readonly canSend = computed(() => !this.disabled() && !this.streaming() && this.text().trim().length > 0);
  private readonly box = viewChild.required<ElementRef<HTMLTextAreaElement>>('box');

  focus(): void {
    this.box().nativeElement.focus();
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      this.submit();
    }
  }

  protected submit(): void {
    if (!this.canSend()) return;
    const value = this.text().trim();
    this.sent.emit(value);
    this.text.set('');
    this.box().nativeElement.value = '';
  }
}
