import { HttpException } from '@nestjs/common';
import { AiErrorCode } from '../ai/ai-error-code';

export class AiErrorException extends HttpException {
  readonly code: AiErrorCode;
  readonly details?: string[];

  constructor(
    status: number,
    code: AiErrorCode,
    message: string,
    details?: string[],
  ) {
    super(
      {
        statusCode: status,
        code,
        message,
        ...(details?.length ? { details } : {}),
      },
      status,
    );
    this.name = 'AiErrorException';
    this.code = code;
    if (details?.length) {
      this.details = details;
    }
  }
}
