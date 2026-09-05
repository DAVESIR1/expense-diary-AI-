import { describe, it, expect } from 'vitest';
import { getTranslation, LANGUAGES } from '../src/data/languages';

describe('translations', () => {
  const en = getTranslation('en');
  const enKeys = Object.keys(en);

  it('every advertised language resolves a full translation object', () => {
    expect(LANGUAGES.length).toBeGreaterThanOrEqual(10);
    for (const lang of LANGUAGES) {
      const t = getTranslation(lang.code);
      expect(t).toBeTruthy();
      // Structural completeness: identical key-set as English (no silent holes).
      expect(Object.keys(t).sort()).toEqual([...enKeys].sort());
      // No empty strings creeping in.
      for (const [key, value] of Object.entries(t)) {
        expect(value, `${lang.code}.${key} must not be empty`).not.toBe('');
      }
    }
  });

  it('en exposes a rich set of UI strings', () => {
    expect(enKeys.length).toBeGreaterThan(80);
    for (const key of ['home', 'income', 'expense', 'save', 'settings'] as const) {
      expect(en[key]).toEqual(expect.any(String));
    }
  });

  it('falls back to English for unknown languages instead of crashing', () => {
    const t = getTranslation('xx-nonexistent');
    expect(t.home).toBe(en.home);
  });
});