import { ErrorHandler, Injectable, Injector, inject } from '@angular/core';
import { AppError } from '../http/app-error';

export function unwrapError(error: unknown): unknown {
  if (error && typeof error === 'object' && 'rejection' in error) return (error as { rejection: unknown }).rejection;
  return error;
}

export function toastMessage(error: AppError): string {
  return error.correlationId
    ? $localize`:@@error.withRef:${error.userMessage}:message: (ref ${error.correlationId.slice(0, 8)}:ref:)`
    : error.userMessage;
}

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly injector = inject(Injector);
  private lastMessage = '';
  private lastAt = 0;

  handleError(error: unknown): void {
    const appError = AppError.from(unwrapError(error));
    if (appError.code === 'ABORTED') return;
    console.error(error);
    const message = toastMessage(appError);
    const now = Date.now();
    if (message === this.lastMessage && now - this.lastAt < 3000) return;
    this.lastMessage = message;
    this.lastAt = now;
    void this.toast(message);
  }

  private async toast(message: string): Promise<void> {
    try {
      const { NotificationService } = await import('./notification.service');
      this.injector.get(NotificationService).error(message);
    } catch {
      return;
    }
  }
}
