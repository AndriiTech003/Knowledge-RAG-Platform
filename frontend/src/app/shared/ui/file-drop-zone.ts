import { ChangeDetectionStrategy, Component, ElementRef, input, output, signal, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'kb-file-drop-zone',
  imports: [MatIconModule, MatButtonModule],
  template: `
    <div
      class="drop"
      [class.drop--over]="dragOver()"
      [class.drop--disabled]="disabled()"
      (dragenter)="onDragOver($event)"
      (dragover)="onDragOver($event)"
      (dragleave)="dragOver.set(false)"
      (drop)="onDrop($event)"
      data-testid="drop-zone"
    >
      <mat-icon aria-hidden="true">upload_file</mat-icon>
      <div class="drop__text">
        <strong i18n="@@ui.dropZone.title">Drag &amp; drop files here</strong>
        <span>{{ hint() ?? defaultHint }}</span>
      </div>
      <button mat-stroked-button type="button" [disabled]="disabled()" (click)="input().nativeElement.click()" i18n="@@ui.dropZone.browse">Browse…</button>
      <input
        #fileInput
        class="drop__input"
        type="file"
        multiple
        [accept]="accept()"
        [disabled]="disabled()"
        (change)="onPick($event)"
        aria-label="Choose files to upload"
        i18n-aria-label="@@ui.dropZone.inputLabel"
        data-testid="file-input"
      />
    </div>
  `,
  styles: `
    .drop {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 18px 20px;
      border: 2px dashed var(--mat-sys-outline-variant);
      border-radius: 16px;
      background: var(--mat-sys-surface-container-lowest);
      transition: border-color 120ms ease, background 120ms ease;
    }
    .drop--over {
      border-color: var(--mat-sys-primary);
      background: color-mix(in srgb, var(--mat-sys-primary) 8%, transparent);
    }
    .drop--disabled {
      opacity: 0.6;
    }
    .drop__text {
      display: grid;
      flex: 1;
      color: var(--mat-sys-on-surface-variant);
    }
    .drop__text strong {
      color: var(--mat-sys-on-surface);
    }
    .drop__input {
      position: absolute;
      width: 1px;
      height: 1px;
      opacity: 0;
      pointer-events: none;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FileDropZone {
  readonly accept = input('.pdf,.docx,.md,.markdown,.html,.htm,.txt');
  readonly hint = input<string | null>(null);
  protected readonly defaultHint = $localize`:@@ui.dropZone.hint:PDF, DOCX, Markdown, HTML or plain text`;
  readonly disabled = input(false);
  readonly files = output<File[]>();
  protected readonly dragOver = signal(false);
  protected readonly input = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (!this.disabled()) this.dragOver.set(true);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    if (this.disabled()) return;
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length) this.files.emit(files);
  }

  protected onPick(event: Event): void {
    const target = event.target as HTMLInputElement;
    const files = Array.from(target.files ?? []);
    if (files.length) this.files.emit(files);
    target.value = '';
  }
}
