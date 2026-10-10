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

  it('exposes the diseños wizard copy in es-AR (SPEC-029)', () => {
    expect(t('wizard.designOccasionTitle')).toBe('Elegí el motivo');
    expect(t('wizard.designMessageTitle')).toBe('Escribí tu mensaje');
    expect(t('wizard.designStyleTitle')).toBe('Elegí el estilo del diseño');
    expect(t('wizard.generatingDesignTitle')).toBe('Creando tu diseño...');
    expect(t('wizard.designOccasionBirthday')).toBe('Cumpleaños');
    expect(
      t('wizard.designMessageCount', { current: 12, total: 140 }),
    ).toBe('12 de 140 caracteres');
    expect(t('wizard.designReady', { title: 'Mi fiesta' })).toBe(
      'Tu diseño Mi fiesta está listo',
    );
    expect(MESSAGES.designGeneration.processing).toMatch(/diseño/);
    expect(MESSAGES.designGeneration.failed).toBeTruthy();
  });

  it('exposes the privacy notice copy in es-AR', () => {
    expect(t('reader.dedicationPrivacy')).toBe(
      'Esta dedicatoria se guarda con el libro.',
    );
    expect(t('config.customStructurePrivacy')).toMatch(/viaja al generador/);
  });

  it('exposes the quota editor copy in es-AR (SPEC-023C)', () => {
    expect(t('editor.quotaMaxEnabled')).toBe('Máx. habilitados');
    expect(t('editor.quotaMaxPerPage')).toBe('Máx. por página');
    expect(t('editor.quotaSave')).toBe('Guardar cupo');
    expect(t('editor.quotaError')).toBe('No pudimos guardar el cupo');
  });

  it('maps known error codes and falls back to the generic message', () => {
    expect(messageForErrorCode('RATE_LIMITED')).toMatch(/demanda/);
    expect(messageForErrorCode('NOPE')).toBe(MESSAGES.errors.generic);
    expect(messageForErrorCode(undefined)).toBe(MESSAGES.errors.generic);
  });
});
