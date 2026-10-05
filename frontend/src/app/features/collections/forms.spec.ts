import { createGrantsForm, grantRow, toGrantsPayload } from './grants.model';
import { filterGroups } from './known-groups';
import { createSourceForm, fillSourceForm, patternControl, presetFor, scheduleFrom, syncKindState, toSourcePayload } from './source-form.model';

describe('source form', () => {
  it('requires a valid start URL for web sources', () => {
    const form = createSourceForm();
    syncKindState(form);
    expect(form.valid).toBe(false);
    form.controls.web.controls.startUrl.setValue('https://docs.example.com');
    expect(form.valid).toBe(true);
  });

  it('rejects invalid include regex patterns and depth out of range', () => {
    const form = createSourceForm();
    form.controls.web.controls.startUrl.setValue('https://docs.example.com');
    form.controls.web.controls.includePatterns.push(patternControl('(unclosed'));
    expect(form.valid).toBe(false);
    form.controls.web.controls.includePatterns.at(0).setValue('^https://docs');
    form.controls.web.controls.maxDepth.setValue(9);
    expect(form.controls.web.controls.maxDepth.errors).toEqual({ max: { max: 5, actual: 9 } });
  });

  it('requires a cron expression only for the custom schedule', () => {
    const form = createSourceForm();
    form.controls.web.controls.startUrl.setValue('https://docs.example.com');
    form.controls.schedulePreset.setValue('custom');
    syncKindState(form);
    expect(form.controls.cron.hasError('required')).toBe(true);
    form.controls.cron.setValue('0 3 * * *');
    expect(form.valid).toBe(true);
  });

  it('builds the API payload', () => {
    const form = createSourceForm();
    form.controls.web.controls.startUrl.setValue(' https://docs.example.com ');
    form.controls.web.controls.excludePatterns.push(patternControl('/archive/'));
    form.controls.schedulePreset.setValue('daily');
    expect(toSourcePayload(form)).toEqual({
      kind: 'web',
      schedule: '0 3 * * *',
      config: { startUrl: 'https://docs.example.com', maxDepth: 2, maxPages: 200, includePatterns: [], excludePatterns: ['/archive/'], respectRobots: true },
    });
  });

  it('round-trips an existing source', () => {
    const form = createSourceForm();
    fillSourceForm(form, {
      id: 's',
      collection_id: 'c',
      kind: 'web',
      config: { startUrl: 'https://x.example.com', maxDepth: 1, maxPages: 10, includePatterns: ['a'], excludePatterns: [], respectRobots: false },
      schedule: '*/30 * * * *',
      last_synced_at: null,
      status: null,
      last_error: null,
    });
    expect(form.controls.schedulePreset.value).toBe('custom');
    expect(toSourcePayload(form).config['includePatterns']).toEqual(['a']);
    expect(presetFor('0 * * * *').preset).toBe('hourly');
    expect(scheduleFrom('none', '')).toBeNull();
  });
});

describe('grants form', () => {
  it('flags duplicate principals', () => {
    const form = createGrantsForm([{ principal_type: 'group', principal_id: 'finance', role: 'viewer' }]);
    form.controls.grants.push(grantRow({ principal_type: 'group', principal_id: 'finance', role: 'owner' }));
    expect(form.controls.grants.hasError('duplicate')).toBe(true);
  });

  it('validates principal ids and maps to the API payload', () => {
    const form = createGrantsForm();
    form.controls.grants.push(grantRow({ principal_type: 'group', principal_id: 'bad id!', role: 'viewer' }));
    expect(form.valid).toBe(false);
    form.controls.grants.at(0).controls.principalId.setValue('engineering');
    expect(toGrantsPayload(form)).toEqual([{ principal_type: 'group', principal_id: 'engineering', role: 'viewer' }]);
  });

  it('autocompletes known groups', () => {
    expect(filterGroups('fin')).toEqual(['finance']);
    expect(filterGroups('')).toHaveLength(5);
  });
});
