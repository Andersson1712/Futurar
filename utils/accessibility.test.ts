import { afterEach, describe, expect, it } from 'vitest';
import {
  applyAccessibilityToDocument,
  DEFAULT_ACCESSIBILITY,
  fontSizePx,
  fromStudentSettings,
  scanningActive,
} from './accessibility';

function resetDocument(): void {
  const root = document.documentElement;
  root.removeAttribute('style');
  root.removeAttribute('data-font-size');
  root.removeAttribute('data-line-height');
  root.removeAttribute('data-bold-titles');
  root.removeAttribute('data-uppercase');
  root.removeAttribute('data-input-mode');
}

describe('accessibility (SPEC-015)', () => {
  afterEach(resetDocument);

  it('uses defaults for missing profiles', () => {
    expect(fromStudentSettings(null)).toEqual(DEFAULT_ACCESSIBILITY);
    expect(fromStudentSettings(undefined)).toEqual(DEFAULT_ACCESSIBILITY);
  });

  it('keeps TTS enabled by default (SPEC-018)', () => {
    expect(DEFAULT_ACCESSIBILITY.voiceFeedback).toBe(true);
    expect(fromStudentSettings({}).voiceFeedback).toBe(true);
    expect(fromStudentSettings({ voice_feedback: false }).voiceFeedback).toBe(
      false,
    );
  });

  it('clamps intervals/columns and rejects unknown values', () => {
    expect(
      fromStudentSettings({
        scan_interval: 50,
        scan_columns: 9,
        input_mode: 'telepathy',
        line_height: 'x',
        font_size: 'x',
        voice_gender: 'x',
      }),
    ).toMatchObject({
      scanInterval: 800,
      scanColumns: 4,
      inputMode: 'scan',
      lineHeight: 'normal',
      fontSize: 'normal',
      voiceGender: 'auto',
    });
  });

  it('maps profile values', () => {
    const settings = fromStudentSettings({
      scan_interval: 1500,
      scan_columns: 3,
      voice_feedback: false,
      sound_enabled: false,
      sweep_enabled: false,
      input_mode: 'touch',
      line_height: 'loose',
      bold_titles: true,
      uppercase: true,
      voice_gender: 'male',
      font_size: 'xlarge',
    });

    expect(settings).toEqual({
      scanInterval: 1500,
      scanColumns: 3,
      voiceFeedback: false,
      soundEnabled: false,
      sweepEnabled: false,
      inputMode: 'touch',
      lineHeight: 'loose',
      boldTitles: true,
      uppercase: true,
      voiceGender: 'male',
      fontSize: 'xlarge',
    });
  });

  it('only scans in scan/switch modes with sweep enabled', () => {
    expect(scanningActive(DEFAULT_ACCESSIBILITY)).toBe(true);
    expect(
      scanningActive({ ...DEFAULT_ACCESSIBILITY, sweepEnabled: false }),
    ).toBe(false);
    expect(
      scanningActive({ ...DEFAULT_ACCESSIBILITY, inputMode: 'mouse' }),
    ).toBe(false);
    expect(
      scanningActive({ ...DEFAULT_ACCESSIBILITY, inputMode: 'touch' }),
    ).toBe(false);
    expect(
      scanningActive({ ...DEFAULT_ACCESSIBILITY, inputMode: 'switch' }),
    ).toBe(true);
  });

  it('maps font sizes to pixels', () => {
    expect([
      fontSizePx('normal'),
      fontSizePx('large'),
      fontSizePx('xlarge'),
    ]).toEqual([16, 19, 22]);
  });

  it('applies attributes and root font size to the document', () => {
    applyAccessibilityToDocument({
      ...DEFAULT_ACCESSIBILITY,
      fontSize: 'xlarge',
      lineHeight: 'loose',
      boldTitles: true,
      uppercase: true,
      inputMode: 'touch',
    });

    const root = document.documentElement;

    expect(root.style.fontSize).toBe('22px');
    expect(root.getAttribute('data-font-size')).toBe('xlarge');
    expect(root.getAttribute('data-line-height')).toBe('loose');
    expect(root.getAttribute('data-bold-titles')).toBe('true');
    expect(root.getAttribute('data-uppercase')).toBe('true');
    expect(root.getAttribute('data-input-mode')).toBe('touch');
  });
});
