export type AiErrorCode =
  | 'PROVIDER_UNAVAILABLE'
  | 'INVALID_REQUEST'
  | 'CONTENT_BLOCKED'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'UNKNOWN';

export class AiProviderError extends Error {
  readonly code: AiErrorCode;

  constructor(code: AiErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'AiProviderError';
    this.code = code;
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

const STATUS_TO_CODE: Record<number, AiErrorCode> = {
  400: 'INVALID_REQUEST',
  401: 'PROVIDER_UNAVAILABLE',
  403: 'CONTENT_BLOCKED',
  404: 'INVALID_REQUEST',
  408: 'TIMEOUT',
  429: 'RATE_LIMITED',
  500: 'PROVIDER_UNAVAILABLE',
  503: 'PROVIDER_UNAVAILABLE',
};

export function toProviderError(error: unknown): AiProviderError {
  if (error instanceof AiProviderError) return error;

  const status =
    typeof error === 'object' && error !== null && 'status' in error
      ? Number(error.status)
      : undefined;

  const code = status !== undefined ? STATUS_TO_CODE[status] : undefined;

  return new AiProviderError(
    code ?? 'UNKNOWN',
    'The AI provider request failed',
    error,
  );
}
