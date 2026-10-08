export const PRESENTATION_AUDIENCES = ['child', 'teen', 'adult'] as const;
export type PresentationAudience = (typeof PRESENTATION_AUDIENCES)[number];

export const PRESENTATION_SLIDE_COUNTS = [5, 8, 10] as const;
export type PresentationSlideCount = (typeof PRESENTATION_SLIDE_COUNTS)[number];

export const PRESENTATION_TOPIC_MAX_LENGTH = 120;
export const PRESENTATION_STYLE_MAX_LENGTH = 80;

export const PRESENTATION_JOB_STATUSES = [
  'queued',
  'processing',
  'completed',
  'failed',
] as const;
export type PresentationJobStatus = (typeof PRESENTATION_JOB_STATUSES)[number];

/**
 * Reads a boolean env flag tolerantly: validated boot config carries real
 * booleans, while test/app harnesses that assign `process.env` after the
 * ConfigModule import-time snapshot are seen as raw `'true'` strings
 * through the ConfigService `process.env` fallback.
 */
export function isPresentationFlagEnabled(value: unknown): boolean {
  return value === true || value === 'true' || value === '1';
}
