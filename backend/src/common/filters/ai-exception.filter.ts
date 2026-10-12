import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { toAiErrorDto } from '../errors/to-ai-error';

@Catch()
export class AiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const error = toAiErrorDto(exception);

    response.status(error.statusCode).json(error);
  }
}
