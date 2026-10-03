import type { CallHandler, ExecutionContext } from '@nestjs/common';
import type { Request, Response } from 'express';
import { of } from 'rxjs';
import { CORRELATION_ID_HEADER } from './correlation-id';
import { CorrelationInterceptor } from './correlation.interceptor';

function buildContext(requestId: unknown): {
  context: ExecutionContext;
  headers: Record<string, string>;
} {
  const headers: Record<string, string> = {};
  const request = { id: requestId, headers: {} } as unknown as Request;
  const response = {
    setHeader: (name: string, value: string) => {
      headers[name] = value;
    },
  } as unknown as Response;
  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as ExecutionContext;

  return { context, headers };
}

const passThrough = { handle: () => of('ok') } as CallHandler;

describe('CorrelationInterceptor (SPEC-027)', () => {
  it('echoes the request correlation id on the response', (done) => {
    const { context, headers } = buildContext('corr-1');

    new CorrelationInterceptor().intercept(context, passThrough).subscribe({
      next: () => {
        expect(headers[CORRELATION_ID_HEADER]).toBe('corr-1');
        done();
      },
    });
  });

  it('generates one when the request has no id yet', (done) => {
    const { context, headers } = buildContext(undefined);

    new CorrelationInterceptor().intercept(context, passThrough).subscribe({
      next: () => {
        expect(headers[CORRELATION_ID_HEADER]).toMatch(/^[0-9a-f-]{36}$/);
        done();
      },
    });
  });
});
