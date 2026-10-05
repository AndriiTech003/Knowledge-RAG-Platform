import { FormArray, FormControl, FormGroup, Validators } from '@angular/forms';
import { SourceCreate, SourceOut } from '../../core/api/models';
import { cronValidator, httpUrlValidator, regexPatternValidator } from '../../shared/forms/validators';

export type SourceKind = 'web' | 'notion';
export type SchedulePreset = 'none' | 'hourly' | 'daily' | 'weekly' | 'custom';

export const SCHEDULE_PRESETS: Record<Exclude<SchedulePreset, 'none' | 'custom'>, string> = {
  hourly: '0 * * * *',
  daily: '0 3 * * *',
  weekly: '0 3 * * 1',
};

export type WebConfigForm = FormGroup<{
  startUrl: FormControl<string>;
  maxDepth: FormControl<number>;
  maxPages: FormControl<number>;
  includePatterns: FormArray<FormControl<string>>;
  excludePatterns: FormArray<FormControl<string>>;
  respectRobots: FormControl<boolean>;
}>;

export type NotionConfigForm = FormGroup<{
  databaseId: FormControl<string>;
  query: FormControl<string>;
}>;

export type SourceForm = FormGroup<{
  kind: FormControl<SourceKind>;
  web: WebConfigForm;
  notion: NotionConfigForm;
  schedulePreset: FormControl<SchedulePreset>;
  cron: FormControl<string>;
}>;

export function patternControl(value = ''): FormControl<string> {
  return new FormControl(value, { nonNullable: true, validators: [Validators.required, regexPatternValidator] });
}

export function createSourceForm(): SourceForm {
  return new FormGroup({
    kind: new FormControl<SourceKind>('web', { nonNullable: true }),
    web: new FormGroup({
      startUrl: new FormControl('', { nonNullable: true, validators: [Validators.required, httpUrlValidator, Validators.maxLength(2000)] }),
      maxDepth: new FormControl(2, { nonNullable: true, validators: [Validators.required, Validators.min(0), Validators.max(5)] }),
      maxPages: new FormControl(200, { nonNullable: true, validators: [Validators.required, Validators.min(1), Validators.max(5000)] }),
      includePatterns: new FormArray<FormControl<string>>([]),
      excludePatterns: new FormArray<FormControl<string>>([]),
      respectRobots: new FormControl(true, { nonNullable: true }),
    }),
    notion: new FormGroup({
      databaseId: new FormControl('', { nonNullable: true, validators: [Validators.pattern(/^[0-9a-fA-F-]{32,36}$/)] }),
      query: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(200)] }),
    }),
    schedulePreset: new FormControl<SchedulePreset>('none', { nonNullable: true }),
    cron: new FormControl('', { nonNullable: true, validators: [cronValidator] }),
  });
}

export function syncKindState(form: SourceForm): void {
  const kind = form.controls.kind.value;
  if (kind === 'web') {
    form.controls.web.enable({ emitEvent: false });
    form.controls.notion.disable({ emitEvent: false });
  } else {
    form.controls.web.disable({ emitEvent: false });
    form.controls.notion.enable({ emitEvent: false });
  }
  const cron = form.controls.cron;
  if (form.controls.schedulePreset.value === 'custom') {
    cron.setValidators([Validators.required, cronValidator]);
  } else {
    cron.setValidators([cronValidator]);
  }
  cron.updateValueAndValidity({ emitEvent: false });
}

export function presetFor(schedule: string | null | undefined): { preset: SchedulePreset; cron: string } {
  if (!schedule) return { preset: 'none', cron: '' };
  for (const [preset, cron] of Object.entries(SCHEDULE_PRESETS)) {
    if (cron === schedule.trim()) return { preset: preset as SchedulePreset, cron: '' };
  }
  return { preset: 'custom', cron: schedule };
}

export function scheduleFrom(preset: SchedulePreset, cron: string): string | null {
  if (preset === 'none') return null;
  if (preset === 'custom') return cron.trim() || null;
  return SCHEDULE_PRESETS[preset];
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

export function fillSourceForm(form: SourceForm, source: SourceOut): void {
  const config = source.config as Record<string, unknown>;
  const kind: SourceKind = source.kind === 'notion' ? 'notion' : 'web';
  const { preset, cron } = presetFor(source.schedule);
  form.controls.kind.setValue(kind);
  const web = form.controls.web.controls;
  web.includePatterns.clear();
  web.excludePatterns.clear();
  if (kind === 'web') {
    web.startUrl.setValue(typeof config['startUrl'] === 'string' ? config['startUrl'] : '');
    web.maxDepth.setValue(typeof config['maxDepth'] === 'number' ? config['maxDepth'] : 2);
    web.maxPages.setValue(typeof config['maxPages'] === 'number' ? config['maxPages'] : 200);
    web.respectRobots.setValue(config['respectRobots'] !== false);
    for (const p of asStringArray(config['includePatterns'])) web.includePatterns.push(patternControl(p));
    for (const p of asStringArray(config['excludePatterns'])) web.excludePatterns.push(patternControl(p));
  } else {
    form.controls.notion.controls.databaseId.setValue(typeof config['databaseId'] === 'string' ? config['databaseId'] : '');
    form.controls.notion.controls.query.setValue(typeof config['query'] === 'string' ? config['query'] : '');
  }
  form.controls.schedulePreset.setValue(preset);
  form.controls.cron.setValue(cron);
  syncKindState(form);
}

export function toSourcePayload(form: SourceForm): SourceCreate {
  const value = form.getRawValue();
  const schedule = scheduleFrom(value.schedulePreset, value.cron);
  if (value.kind === 'web') {
    return {
      kind: 'web',
      schedule,
      config: {
        startUrl: value.web.startUrl.trim(),
        maxDepth: value.web.maxDepth,
        maxPages: value.web.maxPages,
        includePatterns: value.web.includePatterns.map((p) => p.trim()).filter(Boolean),
        excludePatterns: value.web.excludePatterns.map((p) => p.trim()).filter(Boolean),
        respectRobots: value.web.respectRobots,
      },
    };
  }
  return {
    kind: 'notion',
    schedule,
    config: {
      databaseId: value.notion.databaseId.trim() || null,
      query: value.notion.query.trim() || null,
    },
  };
}
