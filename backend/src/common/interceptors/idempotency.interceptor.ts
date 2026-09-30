import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Observable, of, tap } from 'rxjs';
import type { Response } from 'express';
import { AiErrorException } from '../errors/ai-error.exception';
import type { AuthenticatedRequest } from '../guards/supabase-auth.guard';
import { IDEMPOTENCY_STORE } from '../idempotency/idempotency-store';
import type { IdempotencyStore } from '../idempotency/idempotency-store';

export const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const MIN_KEY_LENGTH = 8;
const MAX_KEY_LENGTH = 128;

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor<
  unknown,
  unknown
> {
  constructor(
    @Inject(IDEMPOTENCY_STORE) private readonly store: IdempotencyStore,
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<unknown>,
  ): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<AuthenticatedRequest>();
    const response = http.getResponse<Response>();

    const key = this.readKey(request.headers[IDEMPOTENCY_KEY_HEADER]);
    const scope = `${request.user?.id ?? 'anonymous'}:${key}`;
    const requestHash = hashPayload(request.body);
    const stored = this.store.get(scope);

    if (stored) {
      if (stored.requestHash !== requestHash) {
        throw new AiErrorException(
          409,
          'IDEMPOTENCY_KEY_REUSED',
          'Idempotency-Key was already used with a different payload',
        );
      }

      response.status(stored.statusCode);
      return of(stored.body);
    }

    return next.handle().pipe(
      tap((body) => {
        this.store.set(scope, {
          statusCode: response.statusCode,
          body,
          requestHash,
          expiresAt: Date.now() + IDEMPOTENCY_TTL_MS,
        });
      }),
    );
  }

  private readKey(header: string | string[] | undefined): string {
    if (header === undefined) {
      throw new AiErrorException(
        400,
        'IDEMPOTENCY_KEY_REQUIRED',
        'Idempotency-Key header is required',
      );
    }

    const key = (Array.isArray(header) ? header[0] : header).trim();

    if (key.length < MIN_KEY_LENGTH || key.length > MAX_KEY_LENGTH) {
      throw new AiErrorException(
        400,
        'IDEMPOTENCY_KEY_REQUIRED',
        `Idempotency-Key must be between ${MIN_KEY_LENGTH} and ${MAX_KEY_LENGTH} characters`,
      );
    }

    return key;
  }
}

function hashPayload(body: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(body ?? {}))
    .digest('hex');
}
