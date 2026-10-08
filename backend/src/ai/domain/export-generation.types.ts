export const EXPORT_FORMATS = ['epub'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export const EXPORT_JOB_STATUSES = [
  'queued',
  'processing',
  'completed',
  'failed',
] as const;
export type ExportJobStatus = (typeof EXPORT_JOB_STATUSES)[number];

export const EXPORT_ARTIFACT_PREFIX = 'exports';
export const EXPORT_DOWNLOAD_TTL_SECONDS = 3600;

/**
 * Reads a boolean env flag tolerantly: validated boot config carries real
 * booleans, while test/app harnesses that assign `process.env` after the
 * ConfigModule import-time snapshot are seen as raw `'true'` strings
 * through the ConfigService `process.env` fallback.
 */
export function isExportFlagEnabled(value: unknown): boolean {
  return value === true || value === 'true' || value === '1';
}
