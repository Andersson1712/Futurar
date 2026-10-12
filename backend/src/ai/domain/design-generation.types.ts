export const DESIGN_OCCASIONS = [
  'event',
  'birthday',
  'announcement',
  'invitation',
  'other',
] as const;
export type DesignOccasion = (typeof DESIGN_OCCASIONS)[number];

export const DESIGN_AUDIENCES = ['child', 'teen', 'adult'] as const;
export type DesignAudience = (typeof DESIGN_AUDIENCES)[number];

export const DESIGN_MESSAGE_MAX_LENGTH = 140;

export const DESIGN_JOB_STATUSES = [
  'queued',
  'processing',
  'completed',
  'failed',
] as const;
export type DesignJobStatus = (typeof DESIGN_JOB_STATUSES)[number];

/**
 * Reads a boolean env flag tolerantly: validated boot config carries real
 * booleans, while test/app harnesses that assign `process.env` after the
 * ConfigModule import-time snapshot are seen as raw `'true'` strings
 * through the ConfigService `process.env` fallback.
 */
export function isDesignFlagEnabled(value: unknown): boolean {
  return value === true || value === 'true' || value === '1';
}
