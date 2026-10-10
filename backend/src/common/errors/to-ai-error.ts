import { HttpException } from '@nestjs/common';
import { AiProviderError } from '../../ai/ai.errors';
import type { AiErrorCode as ProviderErrorCode } from '../../ai/ai.errors';
import { AiErrorCode } from '../ai/ai-error-code';
import { AiErrorDto } from '../dto/ai-error.dto';
import { AiErrorException } from './ai-error.exception';

export const PROVIDER_ERROR_STATUS: Record<ProviderErrorCode, number> = {
  INVALID_REQUEST: 400,
  INVALID_OUTPUT: 502,
  CONTENT_BLOCKED: 422,
  RATE_LIMITED: 429,
  TIMEOUT: 504,
  PROVIDER_UNAVAILABLE: 503,
  UNKNOWN: 500,
};

const STATUS_ERROR_CODE: Partial<Record<number, AiErrorCode>> = {
  400: 'INVALID_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'IDEMPOTENCY_KEY_REUSED',
  429: 'RATE_LIMITED',
  501: 'NOT_IMPLEMENTED',
  502: 'INVALID_OUTPUT',
  503: 'PROVIDER_UNAVAILABLE',
  504: 'TIMEOUT',
};

export function toAiErrorDto(exception: unknown): AiErrorDto {
  if (exception instanceof AiErrorException) {
    return {
      statusCode: exception.getStatus(),
      code: exception.code,
      message: exception.message,
      details: exception.details,
    };
  }

  if (exception instanceof AiProviderError) {
    return {
      statusCode: PROVIDER_ERROR_STATUS[exception.code],
      code: exception.code,
      message: exception.message,
    };
  }

  if (exception instanceof HttpException) {
    return fromHttpException(exception);
  }

  return {
    statusCode: 500,
    code: 'INTERNAL',
    message: 'Unexpected server error',
  };
}

function fromHttpException(exception: HttpException): AiErrorDto {
  const status = exception.getStatus();
  const body = exception.getResponse();

  if (status === 400 && isValidationBody(body)) {
    return {
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      message: 'Request validation failed',
      details: body.message,
    };
  }

  return {
    statusCode: status,
    code:
      STATUS_ERROR_CODE[status] ??
      (status < 500 ? 'INVALID_REQUEST' : 'INTERNAL'),
    message: extractMessage(body) ?? exception.message,
  };
}

function isValidationBody(body: unknown): body is { message: string[] } {
  if (typeof body !== 'object' || body === null || !('message' in body)) {
    return false;
  }

  const { message } = body;
  return (
    Array.isArray(message) &&
    message.length > 0 &&
    message.every((entry) => typeof entry === 'string')
  );
}

function extractMessage(body: unknown): string | undefined {
  if (typeof body === 'string') return body;

  if (typeof body === 'object' && body !== null && 'message' in body) {
    const { message } = body;
    if (typeof message === 'string') return message;
  }

  return undefined;
}
