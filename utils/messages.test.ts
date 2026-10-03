import { describe, expect, it } from 'vitest';
import {
  MESSAGES,
  messageForErrorCode,
  t,
  TRANSLATIONS,
  type MessageKey,
} from './messages';

describe('messages (SPEC-018)', () => {
  it('has no empty translations', () => {
    for (const [key, value] of Object.entries(TRANSLATIONS)) {
      expect(value.trim(), `empty translation for ${key}`).not.toBe('');
    }
  });

  it('returns the dictionary value for every key', () => {
    for (const key of Object.keys(TRANSLATIONS) as MessageKey[]) {
      expect(t(key)).toBe(TRANSLATIONS[key]);
    }
  });

  it('interpolates {placeholders} when params are given', () => {
    expect(t('wizard.pageIndicator', { current: 2, total: 3 })).toBe(
      'Página 2 de 3',
    );
  });

  it('throws for unknown keys', () => {
    expect(() => t('nope' as MessageKey)).toThrow(/Missing translation/);
  });

  it('maps known error codes and falls back to the generic message', () => {
    expect(messageForErrorCode('RATE_LIMITED')).toMatch(/demanda/);
    expect(messageForErrorCode('NOPE')).toBe(MESSAGES.errors.generic);
    expect(messageForErrorCode(undefined)).toBe(MESSAGES.errors.generic);
  });
});
