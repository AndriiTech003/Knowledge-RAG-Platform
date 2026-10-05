import { ChangeDetectionStrategy, Component, Injectable, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Observable, map } from 'rxjs';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmText?: string;
  destructive?: boolean;
}

@Component({
  selector: 'kb-confirm-dialog',
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>{{ data.message }}</mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" [mat-dialog-close]="false" data-testid="confirm-cancel" i18n="@@common.cancel">Cancel</button>
      <button
        mat-flat-button
        type="button"
        [class.destructive]="data.destructive"
        [mat-dialog-close]="true"
        cdkFocusInitial
        data-testid="confirm-ok"
      >
        @if (data.confirmText) {
          {{ data.confirmText }}
        } @else {
          <ng-container i18n="@@common.confirm">Confirm</ng-container>
        }
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .destructive {
      --mat-button-filled-container-color: var(--mat-sys-error);
      --mat-button-filled-label-text-color: var(--mat-sys-on-error);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialog {
  protected readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly dialog = inject(MatDialog);

  confirm(data: ConfirmDialogData): Observable<boolean> {
    return this.dialog
      .open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, { data, width: '420px' })
      .afterClosed()
      .pipe(map((result) => result === true));
  }
}
