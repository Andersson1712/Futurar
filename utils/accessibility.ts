export type FontSize = 'normal' | 'large' | 'xlarge';
export type LineHeight = 'normal' | 'relaxed' | 'loose';
export type InputMode = 'scan' | 'switch' | 'mouse' | 'touch';
export type VoiceGender = 'female' | 'male' | 'auto';

export interface AccessibilitySettings {
  scanInterval: number;
  sweepEnabled: boolean;
  inputMode: InputMode;
  scanColumns: number;
  voiceFeedback: boolean;
  voiceGender: VoiceGender;
  soundEnabled: boolean;
  fontSize: FontSize;
  lineHeight: LineHeight;
  boldTitles: boolean;
  uppercase: boolean;
}

export interface StudentSettingsLike {
  scan_interval?: number | null;
  scan_columns?: number | null;
  voice_feedback?: boolean | null;
  sound_enabled?: boolean | null;
  sweep_enabled?: boolean | null;
  input_mode?: string | null;
  line_height?: string | null;
  bold_titles?: boolean | null;
  uppercase?: boolean | null;
  voice_gender?: string | null;
  font_size?: string | null;
}

export const MIN_SCAN_INTERVAL_MS = 800;
export const MAX_SCAN_INTERVAL_MS = 5000;

export const DEFAULT_ACCESSIBILITY: AccessibilitySettings = {
  scanInterval: 3000,
  sweepEnabled: true,
  inputMode: 'scan',
  scanColumns: 2,
  voiceFeedback: true,
  voiceGender: 'auto',
  soundEnabled: true,
  fontSize: 'normal',
  lineHeight: 'normal',
  boldTitles: false,
  uppercase: false,
};

const INPUT_MODES: readonly InputMode[] = ['scan', 'switch', 'mouse', 'touch'];
const LINE_HEIGHTS: readonly LineHeight[] = ['normal', 'relaxed', 'loose'];
const FONT_SIZES: readonly FontSize[] = ['normal', 'large', 'xlarge'];
const VOICE_GENDERS: readonly VoiceGender[] = ['female', 'male', 'auto'];

function pick<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function clampInterval(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_ACCESSIBILITY.scanInterval;
  }

  return Math.min(
    MAX_SCAN_INTERVAL_MS,
    Math.max(MIN_SCAN_INTERVAL_MS, Math.round(value)),
  );
}

function clampColumns(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_ACCESSIBILITY.scanColumns;
  }

  return Math.min(4, Math.max(1, Math.round(value)));
}

function booleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function fromStudentSettings(
  settings?: StudentSettingsLike | null,
): AccessibilitySettings {
  if (!settings) return DEFAULT_ACCESSIBILITY;

  return {
    scanInterval: clampInterval(settings.scan_interval),
    scanColumns: clampColumns(settings.scan_columns),
    voiceFeedback: booleanOr(
      settings.voice_feedback,
      DEFAULT_ACCESSIBILITY.voiceFeedback,
    ),
    soundEnabled: booleanOr(
      settings.sound_enabled,
      DEFAULT_ACCESSIBILITY.soundEnabled,
    ),
    sweepEnabled: booleanOr(
      settings.sweep_enabled,
      DEFAULT_ACCESSIBILITY.sweepEnabled,
    ),
    inputMode: pick(settings.input_mode, INPUT_MODES, DEFAULT_ACCESSIBILITY.inputMode),
    lineHeight: pick(
      settings.line_height,
      LINE_HEIGHTS,
      DEFAULT_ACCESSIBILITY.lineHeight,
    ),
    boldTitles: booleanOr(
      settings.bold_titles,
      DEFAULT_ACCESSIBILITY.boldTitles,
    ),
    uppercase: booleanOr(settings.uppercase, DEFAULT_ACCESSIBILITY.uppercase),
    voiceGender: pick(
      settings.voice_gender,
      VOICE_GENDERS,
      DEFAULT_ACCESSIBILITY.voiceGender,
    ),
    fontSize: pick(settings.font_size, FONT_SIZES, DEFAULT_ACCESSIBILITY.fontSize),
  };
}

export function fontSizePx(size: FontSize): number {
  if (size === 'large') return 19;
  if (size === 'xlarge') return 22;

  return 16;
}

export function scanningActive(settings: AccessibilitySettings): boolean {
  return (
    settings.sweepEnabled &&
    (settings.inputMode === 'scan' || settings.inputMode === 'switch')
  );
}

export function applyAccessibilityToDocument(
  settings: AccessibilitySettings,
): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;

  root.style.fontSize = `${fontSizePx(settings.fontSize)}px`;
  root.setAttribute('data-font-size', settings.fontSize);
  root.setAttribute('data-line-height', settings.lineHeight);
  root.setAttribute('data-bold-titles', String(settings.boldTitles));
  root.setAttribute('data-uppercase', String(settings.uppercase));
  root.setAttribute('data-input-mode', settings.inputMode);
}
