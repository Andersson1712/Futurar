import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';
import { CORRELATION_ID_HEADER, requestCorrelationId } from './correlation-id';

/**
 * SPEC-027: echo the request correlation id back on every response so
 * clients (and the frontend) can attach it to bug reports.
 */
@Injectable()
export class CorrelationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    response.setHeader(CORRELATION_ID_HEADER, requestCorrelationId(request));

    return next.handle();
  }
}
