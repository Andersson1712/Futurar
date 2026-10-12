import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService } from './metrics.service';

/**
 * SPEC-027: count every HTTP request by status family and measure latency.
 * Registered globally; health/metrics endpoints are counted like the rest.
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const startedAt = Date.now();
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      tap({
        next: () => this.record(response, startedAt),
        error: () => this.record(response, startedAt),
      }),
    );
  }

  private record(response: Response, startedAt: number): void {
    this.metrics.recordHttpRequest(response.statusCode, Date.now() - startedAt);
  }
}
