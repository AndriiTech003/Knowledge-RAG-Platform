import { FormControl } from '@angular/forms';
import { cronValidator, errorMessage, httpUrlValidator, isValidCron, regexPatternValidator } from './validators';

describe('custom validators', () => {
  it('validates regular expressions', () => {
    expect(regexPatternValidator(new FormControl('^/docs/.*$'))).toBeNull();
    expect(regexPatternValidator(new FormControl('([a-z'))).toEqual({ regex: { value: '([a-z' } });
    expect(regexPatternValidator(new FormControl(''))).toBeNull();
  });

  it('accepts only http(s) URLs', () => {
    expect(httpUrlValidator(new FormControl('https://docs.example.com/guide'))).toBeNull();
    expect(httpUrlValidator(new FormControl('ftp://example.com'))).not.toBeNull();
    expect(httpUrlValidator(new FormControl('not a url'))).not.toBeNull();
  });

  it('validates 5-field cron expressions', () => {
    expect(isValidCron('0 3 * * *')).toBe(true);
    expect(isValidCron('*/15 9-17 * * 1-5')).toBe(true);
    expect(isValidCron('0 3 * *')).toBe(false);
    expect(cronValidator(new FormControl('every day'))).toEqual({ cron: { value: 'every day' } });
  });

  it('produces readable error messages', () => {
    expect(errorMessage({ regex: true })).toBe('Not a valid regular expression');
    expect(errorMessage({ max: { max: 5 } })).toBe('Maximum is 5');
    expect(errorMessage(null)).toBe('');
  });
});
