import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function isValidRegex(pattern: string): boolean {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

export const regexPatternValidator: ValidatorFn = (control: AbstractControl<string | null>): ValidationErrors | null => {
  const value = control.value;
  if (value === null || value === '') return null;
  return isValidRegex(value) ? null : { regex: { value } };
};

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname.length > 0;
  } catch {
    return false;
  }
}

export const httpUrlValidator: ValidatorFn = (control: AbstractControl<string | null>): ValidationErrors | null => {
  const value = (control.value ?? '').trim();
  if (!value) return null;
  return isHttpUrl(value) ? null : { url: { value } };
};

const CRON_FIELD = /^(\*|\?|[0-9A-Za-z]+(-[0-9A-Za-z]+)?)(\/\d+)?(,(\*|[0-9A-Za-z]+(-[0-9A-Za-z]+)?)(\/\d+)?)*$/;

export function isValidCron(expression: string): boolean {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return false;
  return fields.every((field) => CRON_FIELD.test(field));
}

export const cronValidator: ValidatorFn = (control: AbstractControl<string | null>): ValidationErrors | null => {
  const value = (control.value ?? '').trim();
  if (!value) return null;
  return isValidCron(value) ? null : { cron: { value } };
};

export const PRINCIPAL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._@/-]{0,127}$/;

export function errorMessage(errors: ValidationErrors | null | undefined): string {
  if (!errors) return '';
  if (errors['required']) return $localize`:@@validation.required:Required`;
  if (errors['regex']) return $localize`:@@validation.regex:Not a valid regular expression`;
  if (errors['url']) return $localize`:@@validation.url:Enter a valid http(s) URL`;
  if (errors['cron']) return $localize`:@@validation.cron:Use a 5-field cron expression, e.g. 0 3 * * *`;
  if (errors['pattern']) return $localize`:@@validation.pattern:Invalid format`;
  if (errors['min']) return $localize`:@@validation.min:Minimum is ${errors['min'].min}:min:`;
  if (errors['max']) return $localize`:@@validation.max:Maximum is ${errors['max'].max}:max:`;
  if (errors['maxlength']) return $localize`:@@validation.maxlength:At most ${errors['maxlength'].requiredLength}:max: characters`;
  if (errors['duplicate']) return $localize`:@@validation.duplicate:Duplicate entry`;
  return $localize`:@@validation.invalid:Invalid value`;
}
