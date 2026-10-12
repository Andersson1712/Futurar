import type { AiErrorCode as ProviderErrorCode } from '../../ai/ai.errors';

export type AiErrorCode =
  | ProviderErrorCode
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'IDEMPOTENCY_KEY_REQUIRED'
  | 'IDEMPOTENCY_KEY_REUSED'
  | 'AI_ENDPOINTS_DISABLED'
  | 'NOT_IMPLEMENTED'
  | 'VALIDATION_FAILED'
  | 'LIMIT_EXCEEDED'
  | 'JOB_NOT_READY'
  | 'INVALID_MODEL'
  | 'INTERNAL';
