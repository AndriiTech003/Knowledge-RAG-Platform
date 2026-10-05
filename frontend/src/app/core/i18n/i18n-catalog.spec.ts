import en from '../../../locale/messages.json';
import uk from '../../../locale/messages.uk.json';

const source: Record<string, string> = en.translations;
const target: Record<string, string> = uk.translations;

function placeholders(text: string): string[] {
  return [...new Set(text.match(/\{\$[A-Za-z0-9_]+\}|\{[A-Z_0-9]+\}|\{count\}/g) ?? [])].sort();
}

describe('i18n catalogs', () => {
  it('declare their locales', () => {
    expect(en.locale).toBe('en');
    expect(uk.locale).toBe('uk');
  });

  it('contain exactly the same message ids in English and Ukrainian', () => {
    const missingInUk = Object.keys(source).filter((id) => !(id in target));
    const unknownInUk = Object.keys(target).filter((id) => !(id in source));
    expect(missingInUk).toEqual([]);
    expect(unknownInUk).toEqual([]);
    expect(Object.keys(source).length).toBeGreaterThan(500);
  });

  it('has a non-empty Ukrainian text with the same placeholders for every message', () => {
    for (const [id, text] of Object.entries(source)) {
      expect(target[id]?.trim(), id).toBeTruthy();
      expect(placeholders(target[id]), id).toEqual(placeholders(text));
    }
  });

  it('uses all Ukrainian plural categories in ICU plurals', () => {
    const plurals = Object.entries(source).filter(([, text]) => /\{VAR_PLURAL, plural,/.test(text));
    expect(plurals.length).toBeGreaterThan(10);
    for (const [id] of plurals) {
      expect(target[id], id).toMatch(/^\{VAR_PLURAL, plural,/);
      for (const category of ['one', 'few', 'many', 'other']) expect(target[id], `${id} ${category}`).toContain(` ${category} {`);
    }
  });

  it('is actually translated', () => {
    const untouched = Object.keys(source).filter((id) => source[id] === target[id]);
    expect(untouched.length / Object.keys(source).length).toBeLessThan(0.05);
    expect(target['shell.nav.chat']).toBe('Чат');
    expect(target['status.forbidden.title']).toBe('Доступ заборонено');
  });
});
