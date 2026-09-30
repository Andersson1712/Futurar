import { CallHandler, ExecutionContext } from '@nestjs/common';
import type { Response } from 'express';
import { lastValueFrom, of } from 'rxjs';
import type { AuthenticatedRequest } from '../guards/supabase-auth.guard';
import { InMemoryIdempotencyStore } from '../idempotency/in-memory-idempotency.store';
import { IdempotencyInterceptor } from './idempotency.interceptor';

interface MockResponse {
  statusCode: number;
  status: jest.Mock;
}

function buildContext(body: unknown, key?: string, userId = 'user-1') {
  const headers: Record<string, string> = {};

  if (key !== undefined) {
    headers['idempotency-key'] = key;
  }

  const request = {
    headers,
    body,
    user: { id: userId },
  } as unknown as AuthenticatedRequest;

  const response: MockResponse = {
    statusCode: 202,
    status: jest.fn(),
  };
  response.status.mockImplementation((code: number) => {
    response.statusCode = code;
    return response;
  });

  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response as unknown as Response,
    }),
  } as unknown as ExecutionContext;

  return { context, response };
}

const buildHandler = (body: unknown): CallHandler<unknown> => ({
  handle: () => of(body),
});

describe('IdempotencyInterceptor', () => {
  const store = new InMemoryIdempotencyStore();
  const interceptor = new IdempotencyInterceptor(store);

  it('rejects requests without the header', () => {
    const { context } = buildContext({ a: 1 });

    expect(() =>
      interceptor.intercept(context, buildHandler({ jobId: '1' })),
    ).toThrow(
      expect.objectContaining({ code: 'IDEMPOTENCY_KEY_REQUIRED' }) as Error,
    );
  });

  it('rejects keys outside the allowed length', () => {
    const { context } = buildContext({ a: 1 }, 'short');

    expect(() =>
      interceptor.intercept(context, buildHandler({ jobId: '1' })),
    ).toThrow(
      expect.objectContaining({ code: 'IDEMPOTENCY_KEY_REQUIRED' }) as Error,
    );
  });

  it('passes through and replays the stored response', async () => {
    const { context, response } = buildContext({ a: 1 }, 'key-12345678');

    const first = await lastValueFrom(
      interceptor.intercept(context, buildHandler({ jobId: 'job-1' })),
    );
    const replay = await lastValueFrom(
      interceptor.intercept(context, buildHandler({ jobId: 'job-2' })),
    );

    expect(first).toEqual({ jobId: 'job-1' });
    expect(replay).toEqual({ jobId: 'job-1' });
    expect(response.status).toHaveBeenCalledWith(202);
  });

  it('rejects key reuse with a different payload', async () => {
    const key = 'key-12345678';
    const { context } = buildContext({ a: 1 }, key);

    await lastValueFrom(
      interceptor.intercept(context, buildHandler({ jobId: 'job-1' })),
    );

    const { context: otherContext } = buildContext({ a: 2 }, key);

    expect(() =>
      interceptor.intercept(otherContext, buildHandler({ jobId: 'job-2' })),
    ).toThrow(
      expect.objectContaining({ code: 'IDEMPOTENCY_KEY_REUSED' }) as Error,
    );
  });

  it('scopes keys per user', async () => {
    const key = 'key-12345678';
    const { context: firstContext } = buildContext({ a: 1 }, key, 'user-1');

    await lastValueFrom(
      interceptor.intercept(firstContext, buildHandler({ jobId: 'job-1' })),
    );

    const { context: otherUserContext } = buildContext({ a: 2 }, key, 'user-2');

    await expect(
      lastValueFrom(
        interceptor.intercept(
          otherUserContext,
          buildHandler({ jobId: 'job-2' }),
        ),
      ),
    ).resolves.toEqual({ jobId: 'job-2' });
  });
});
