import { http, HttpResponse } from 'msw';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { server } from '../test/msw/server';
import { API_BASE, SAMPLE_JOB, sseResponse } from '../test/msw/handlers';
import {
  followJob,
  requestBookGeneration,
  type BookGenerationInput,
} from './bookGeneration';

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'token-1' } },
      }),
      refreshSession: vi.fn(),
    },
  },
}));

const INPUT: BookGenerationInput = {
  protagonist: 'Un dragón curioso',
  scenery: 'Un bosque mágico',
  mission: 'Encontrar la estrella perdida',
  style: 'Acuarela',
  storySize: 'small',
  profileId: 'student-1',
};

describe('bookGeneration (SPEC-017)', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('requests generation with an idempotency key and the request body', async () => {
    let headers: Headers | undefined;
    let body: unknown;

    server.use(
      http.post(`${API_BASE}/api/v1/ai/books/generate`, async ({ request }) => {
        headers = request.headers;
        body = await request.json();

        return HttpResponse.json(
          { jobId: 'job-1', status: 'queued' },
          { status: 202 },
        );
      }),
    );

    const response = await requestBookGeneration(INPUT);

    expect(response).toEqual({ jobId: 'job-1', status: 'queued' });
    expect(headers?.get('Idempotency-Key')).toBeTruthy();
    expect(body).toMatchObject({
      protagonist: 'Un dragón curioso',
      profileId: 'student-1',
    });
  });

  it('follows the job through SSE and reports every status', async () => {
    const statuses: string[] = [];

    const finalStatus = await followJob('job-1', {
      onStatus: (status) => statuses.push(status.status),
    });

    expect(statuses).toEqual(['processing', 'completed']);
    expect(finalStatus.book?.title).toBe('La aventura del dragón');
  });

  it('falls back to polling when the stream fails', async () => {
    let polls = 0;

    server.use(
      http.get(`${API_BASE}/api/v1/ai/jobs/:id/events`, () =>
        HttpResponse.json(
          { statusCode: 503, code: 'PROVIDER_UNAVAILABLE', message: 'down' },
          { status: 503 },
        ),
      ),
      http.get(`${API_BASE}/api/v1/ai/jobs/:id`, () => {
        polls += 1;

        if (polls === 1) {
          return HttpResponse.json({ ...SAMPLE_JOB, status: 'processing' });
        }

        return HttpResponse.json(SAMPLE_JOB);
      }),
    );

    const statuses: string[] = [];
    const finalStatus = await followJob('job-1', {
      onStatus: (status) => statuses.push(status.status),
    });

    expect(polls).toBeGreaterThanOrEqual(2);
    expect(statuses).toContain('completed');
    expect(finalStatus.status).toBe('completed');
  }, 15_000);

  it('rejects with AbortError when aborted while waiting', async () => {
    server.use(
      http.get(`${API_BASE}/api/v1/ai/jobs/:id/events`, () =>
        HttpResponse.json(
          { statusCode: 503, code: 'PROVIDER_UNAVAILABLE', message: 'down' },
          { status: 503 },
        ),
      ),
      http.get(`${API_BASE}/api/v1/ai/jobs/:id`, () =>
        HttpResponse.json({ ...SAMPLE_JOB, status: 'processing' }),
      ),
    );

    const controller = new AbortController();
    const promise = followJob('job-1', { signal: controller.signal });
    controller.abort();

    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('throws when the stream emits an error event', async () => {
    server.use(
      http.get(`${API_BASE}/api/v1/ai/jobs/:id/events`, () =>
        sseResponse([
          {
            type: 'error',
            data: {
              statusCode: 404,
              code: 'NOT_FOUND',
              message: 'Job not found',
            },
          },
        ]),
      ),
    );

    await expect(followJob('missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
