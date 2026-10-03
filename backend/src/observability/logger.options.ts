import { randomUUID } from 'node:crypto';
import type { Params } from 'nestjs-pino';
import type { LogLevelOption } from '../config/env.validation';
import { CORRELATION_ID_HEADER, resolveCorrelationId } from './correlation-id';

/**
 * SPEC-027: logger wiring. Request logs carry the correlation id
 * (`x-correlation-id` honored, UUID fallback) and never leak credentials:
 * authorization/cookie headers are redacted at the serializer level.
 */
export function buildLoggerOptions(level: LogLevelOption): Params {
  return {
    pinoHttp: {
      level,
      genReqId: (req) =>
        resolveCorrelationId(req.headers[CORRELATION_ID_HEADER]),
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.headers["x-api-key"]',
        ],
        censor: '[Redacted]',
      },
      autoLogging: true,
    },
  };
}

export function resolveLogLevel(
  configured: LogLevelOption | undefined,
): LogLevelOption {
  return configured ?? 'info';
}

export function newRunId(): string {
  return randomUUID();
}
