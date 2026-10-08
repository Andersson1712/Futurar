import { apiFetch } from './backendApi';
import { createIdempotencyKey } from './bookGeneration';

export type ExportFormat = 'epub' | 'pdf';

export interface ExportGenerationInput {
  format: ExportFormat;
}

export async function requestBookExport(
  bookId: string,
  input: ExportGenerationInput,
  init: RequestInit = {},
): Promise<{ jobId: string; status: string }> {
  return apiFetch(`/api/v1/exports/books/${encodeURIComponent(bookId)}`, {
    ...init,
    method: 'POST',
    headers: { 'Idempotency-Key': createIdempotencyKey(), ...(init.headers ?? {}) },
    body: JSON.stringify(input),
  });
}

export async function requestDesignExport(
  designId: string,
  input: ExportGenerationInput,
  init: RequestInit = {},
): Promise<{ jobId: string; status: string }> {
  return apiFetch(`/api/v1/exports/designs/${encodeURIComponent(designId)}`, {
    ...init,
    method: 'POST',
    headers: { 'Idempotency-Key': createIdempotencyKey(), ...(init.headers ?? {}) },
    body: JSON.stringify(input),
  });
}

export async function getExportDownload(
  jobId: string,
  init: RequestInit = {},
): Promise<{ downloadUrl: string }> {
  return apiFetch<{ downloadUrl: string }>(
    `/api/v1/exports/${encodeURIComponent(jobId)}/download`,
    init,
  );
}
