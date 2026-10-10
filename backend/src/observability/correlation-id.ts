import { randomUUID } from 'node:crypto';
import type { Request } from 'express';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

const MAX_CORRELATION_ID_LENGTH = 128;

/**
 * SPEC-027: resolve the correlation id for a request. An incoming
 * `x-correlation-id` header is honored when present and well-formed;
 * otherwise a UUID is generated so every request is traceable.
 */
export function resolveCorrelationId(
  headerValue: string | string[] | undefined,
): string {
  const candidate = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  const trimmed = candidate?.trim();

  if (
    trimmed &&
    trimmed.length <= MAX_CORRELATION_ID_LENGTH &&
    /^[\w\-.~:]+$/.test(trimmed)
  ) {
    return trimmed;
  }

  return randomUUID();
}

/** Read the pino-http request id (the correlation id) from an Express request. */
export function requestCorrelationId(request: Request): string {
  const id = (request as Request & { id?: unknown }).id;

  return typeof id === 'string' && id ? id : randomUUID();
}
