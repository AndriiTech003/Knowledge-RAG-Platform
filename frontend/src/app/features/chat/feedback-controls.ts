import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FeedbackReason } from './chat.models';

export interface FeedbackSubmission {
  rating: 1 | -1;
  reason: FeedbackReason | null;
  comment: string | null;
}

export interface FeedbackReasonOption {
  value: FeedbackReason;
  label: string;
}

export function feedbackReasons(): FeedbackReasonOption[] {
  return [
    { value: 'wrong', label: $localize`:@@chat.feedback.reasonWrong:Wrong answer` },
    { value: 'incomplete', label: $localize`:@@chat.feedback.reasonIncomplete:Incomplete` },
    { value: 'no_citation', label: $localize`:@@chat.feedback.reasonNoCitation:Missing citation` },
    { value: 'outdated', label: $localize`:@@chat.feedback.reasonOutdated:Outdated information` },
    { value: 'other', label: $localize`:@@chat.feedback.reasonOther:Other` },
  ];
}

@Component({
  selector: 'kb-feedback-controls',
  imports: [ReactiveFormsModule, MatButtonModule, MatIconModule, MatRadioModule, MatFormFieldModule, MatInputModule, MatTooltipModule],
  template: `
    <div class="feedback" data-testid="feedback">
      <button
        mat-icon-button
        type="button"
        [class.on]="value() === 1"
        [disabled]="value() !== null"
        (click)="submitted.emit({ rating: 1, reason: null, comment: null })"
        matTooltip="Helpful"
        i18n-matTooltip="@@chat.feedback.helpful"
        aria-label="Helpful answer"
        i18n-aria-label="@@chat.feedback.helpfulLabel"
        [attr.aria-pressed]="value() === 1"
        data-testid="feedback-up"
      >
        <mat-icon>thumb_up</mat-icon>
      </button>
      <button
        mat-icon-button
        type="button"
        [class.on]="value() === -1"
        [disabled]="value() !== null"
        (click)="formOpen.set(!formOpen())"
        matTooltip="Not helpful"
        i18n-matTooltip="@@chat.feedback.notHelpful"
        aria-label="Not helpful answer"
        i18n-aria-label="@@chat.feedback.notHelpfulLabel"
        [attr.aria-pressed]="value() === -1"
        [attr.aria-expanded]="formOpen()"
        data-testid="feedback-down"
      >
        <mat-icon>thumb_down</mat-icon>
      </button>
      @if (value() !== null) {
        <span class="feedback__thanks" role="status" i18n="@@chat.feedback.thanks">Thanks for the feedback</span>
      }
    </div>
    @if (formOpen() && value() === null) {
      <form class="feedback__form" [formGroup]="form" (ngSubmit)="submitNegative()" data-testid="feedback-form">
        <mat-radio-group formControlName="reason" aria-label="What went wrong?" i18n-aria-label="@@chat.feedback.reasonLabel" class="feedback__reasons">
          @for (reason of reasons; track reason.value) {
            <mat-radio-button [value]="reason.value">{{ reason.label }}</mat-radio-button>
          }
        </mat-radio-group>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label i18n="@@chat.feedback.comment">Comment (optional)</mat-label>
          <textarea matInput formControlName="comment" rows="2" maxlength="1000" data-testid="feedback-comment"></textarea>
        </mat-form-field>
        <div class="feedback__actions">
          <button mat-button type="button" (click)="formOpen.set(false)" i18n="@@common.cancel">Cancel</button>
          <button mat-flat-button type="submit" [disabled]="form.invalid" data-testid="feedback-submit" i18n="@@chat.feedback.submit">Send feedback</button>
        </div>
      </form>
    }
  `,
  styles: `
    .feedback {
      display: flex;
      align-items: center;
      gap: 2px;
    }
    .on {
      color: var(--mat-sys-primary);
    }
    .feedback__thanks {
      margin-left: 6px;
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
    .feedback__form {
      display: grid;
      gap: 8px;
      margin-top: 8px;
      padding: 12px;
      border-radius: 12px;
      background: var(--mat-sys-surface-container);
    }
    .feedback__reasons {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 12px;
    }
    .feedback__actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeedbackControls {
  readonly value = input<1 | -1 | null>(null);
  readonly submitted = output<FeedbackSubmission>();
  protected readonly formOpen = signal(false);
  protected readonly reasons = feedbackReasons();
  protected readonly form = new FormGroup({
    reason: new FormControl<FeedbackReason | null>(null, { validators: [Validators.required] }),
    comment: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(1000)] }),
  });

  protected submitNegative(): void {
    if (this.form.invalid) return;
    const { reason, comment } = this.form.getRawValue();
    this.submitted.emit({ rating: -1, reason, comment: comment.trim() || null });
    this.formOpen.set(false);
  }
}
