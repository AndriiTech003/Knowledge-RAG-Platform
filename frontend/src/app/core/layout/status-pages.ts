import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'kb-forbidden',
  imports: [MatIconModule, MatButtonModule, RouterLink],
  template: `
    <section class="kb-status-page" data-testid="forbidden">
      <mat-icon>lock</mat-icon>
      <h1 i18n="@@status.forbidden.title">Access denied</h1>
      <p i18n="@@status.forbidden.message">This area is available to knowledge-base administrators only.</p>
      <a mat-flat-button routerLink="/chat" i18n="@@status.backToChat">Back to chat</a>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForbiddenPage {}

@Component({
  selector: 'kb-not-found',
  imports: [MatIconModule, MatButtonModule, RouterLink],
  template: `
    <section class="kb-status-page" data-testid="not-found">
      <mat-icon>travel_explore</mat-icon>
      <h1 i18n="@@status.notFound.title">Page not found</h1>
      <p i18n="@@status.notFound.message">The page you are looking for does not exist.</p>
      <a mat-flat-button routerLink="/chat" i18n="@@status.backToChat">Back to chat</a>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundPage {}
