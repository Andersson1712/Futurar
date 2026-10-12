import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  parseHex,
  relativeLuminance,
  WCAG_AA_LARGE_TEXT,
  WCAG_AA_NON_TEXT,
  WCAG_AA_TEXT,
} from './contrast';

const BACKGROUND_DARK = '#0B1116';
const SURFACE_DARK = '#16202a';
const PRIMARY = '#0b6bd3';
const GRAY_300 = '#d1d5db';
const GRAY_400 = '#9ca3af';
const GRAY_500 = '#6b7280';
const WHITE = '#ffffff';

describe('contrast (SPEC-016)', () => {
  it('parses hex colors, including shorthand', () => {
    expect(parseHex('#fff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseHex('#0b6bd3')).toEqual({ r: 11, g: 107, b: 211 });
    expect(() => parseHex('nope')).toThrow(/Invalid hex/);
  });

  it('computes relative luminance', () => {
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5);
  });

  it('body text on dark backgrounds meets AA 4.5:1', () => {
    expect(contrastRatio(WHITE, BACKGROUND_DARK)).toBeGreaterThanOrEqual(
      WCAG_AA_TEXT,
    );
    expect(contrastRatio(GRAY_300, BACKGROUND_DARK)).toBeGreaterThanOrEqual(
      WCAG_AA_TEXT,
    );
    expect(contrastRatio(GRAY_400, BACKGROUND_DARK)).toBeGreaterThanOrEqual(
      WCAG_AA_TEXT,
    );
    expect(contrastRatio(GRAY_400, SURFACE_DARK)).toBeGreaterThanOrEqual(
      WCAG_AA_TEXT,
    );
  });

  it('documents that gray-500 fails body text on dark', () => {
    expect(contrastRatio(GRAY_500, BACKGROUND_DARK)).toBeLessThan(
      WCAG_AA_TEXT,
    );
  });

  it('primary buttons keep white text at AA level', () => {
    expect(contrastRatio(WHITE, PRIMARY)).toBeGreaterThanOrEqual(
      WCAG_AA_TEXT,
    );
  });

  it('primary and borders meet non-text/large contrast on dark', () => {
    expect(contrastRatio(PRIMARY, BACKGROUND_DARK)).toBeGreaterThanOrEqual(
      WCAG_AA_NON_TEXT,
    );
    expect(contrastRatio(WHITE, PRIMARY)).toBeGreaterThanOrEqual(
      WCAG_AA_LARGE_TEXT,
    );
  });
});
