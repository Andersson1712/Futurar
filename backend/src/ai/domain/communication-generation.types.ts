export const COMMUNICATION_KINDS = ['feelings', 'help', 'custom'] as const;
export type CommunicationKind = (typeof COMMUNICATION_KINDS)[number];

export const COMMUNICATION_AUDIENCES = ['child', 'teen', 'adult'] as const;
export type CommunicationAudience = (typeof COMMUNICATION_AUDIENCES)[number];

export const COMMUNICATION_CELL_COUNTS = [4, 6, 8] as const;
export type CommunicationCellCount = (typeof COMMUNICATION_CELL_COUNTS)[number];

export const COMMUNICATION_TOPIC_MAX_LENGTH = 120;
export const COMMUNICATION_STYLE_MAX_LENGTH = 80;

export const COMMUNICATION_JOB_STATUSES = [
  'queued',
  'processing',
  'completed',
  'failed',
] as const;
export type CommunicationJobStatus =
  (typeof COMMUNICATION_JOB_STATUSES)[number];

/**
 * Reads a boolean env flag tolerantly: validated boot config carries real
 * booleans, while test/app harnesses that assign `process.env` after the
 * ConfigModule import-time snapshot are seen as raw `'true'` strings
 * through the ConfigService `process.env` fallback.
 */
export function isCommunicationFlagEnabled(value: unknown): boolean {
  return value === true || value === 'true' || value === '1';
}
