import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

export type ToastKind = 'info' | 'success' | 'error';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly snackBar = inject(MatSnackBar);

  show(message: string, kind: ToastKind = 'info', action?: string): void {
    this.snackBar.open(message, action ?? $localize`:@@common.dismiss:Dismiss`, {
      duration: kind === 'error' ? 8000 : 4000,
      panelClass: [`kb-toast-${kind}`],
      politeness: kind === 'error' ? 'assertive' : 'polite',
    });
  }

  info(message: string): void {
    this.show(message, 'info');
  }

  success(message: string): void {
    this.show(message, 'success');
  }

  error(message: string): void {
    this.show(message, 'error');
  }
}
