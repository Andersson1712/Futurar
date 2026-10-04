import { http, HttpResponse } from 'msw';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { server } from '../test/msw/server';
import { API_BASE } from '../test/msw/handlers';
import {
  DESIGN_MESSAGE_MAX_LENGTH,
  designDetailToStory,
  getStudentDesign,
  listStudentDesigns,
  requestDesignGeneration,
  type DesignDetailPayload,
  type DesignSummaryPayload,
} from './backendDesigns';

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

const SAMPLE_SUMMARY: DesignSummaryPayload = {
  id: 'design-1',
  title: 'Mi fiesta de cumple',
  occasion: 'birthday',
  version: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const SAMPLE_DETAIL: DesignDetailPayload = {
  id: 'design-1',
  title: 'Mi fiesta de cumple',
  message: 'Fiesta de cumple el sábado a las 17',
  occasion: 'birthday',
  style: 'Acuarela',
  audience: 'child',
  imageUrl: 'https://signed.example/designs/design-1.png',
  version: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('backendDesigns (SPEC-029)', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('lists designs filtered by profile', async () => {
    let profileId: string | null = null;

    server.use(
      http.get(`${API_BASE}/api/v1/designs`, ({ request }) => {
        profileId = new URL(request.url).searchParams.get('profileId');

        return HttpResponse.json([SAMPLE_SUMMARY]);
      }),
    );

    const designs = await listStudentDesigns('student-1');

    expect(profileId).toBe('student-1');
    expect(designs).toEqual([SAMPLE_SUMMARY]);
  });

  it('loads a design detail by id', async () => {
    server.use(
      http.get(`${API_BASE}/api/v1/designs/:id`, () =>
        HttpResponse.json(SAMPLE_DETAIL),
      ),
    );

    const design = await getStudentDesign('design-1');

    expect(design).toEqual(SAMPLE_DETAIL);
    expect(design.message).toBe('Fiesta de cumple el sábado a las 17');
  });

  it('requests generation with an idempotency key and the flyer brief', async () => {
    let idempotencyKey: string | null = null;
    let body: unknown;

    server.use(
      http.post(
        `${API_BASE}/api/v1/ai/designs/generate`,
        async ({ request }) => {
          idempotencyKey = request.headers.get('Idempotency-Key');
          body = await request.json();

          return HttpResponse.json(
            { jobId: 'design-job-1', status: 'queued' },
            { status: 202 },
          );
        },
      ),
    );

    const response = await requestDesignGeneration({
      occasion: 'birthday',
      message: 'Fiesta de cumple el sábado a las 17',
      style: 'Acuarela',
      profileId: 'student-1',
    });

    expect(response).toEqual({ jobId: 'design-job-1', status: 'queued' });
    expect(idempotencyKey).toBeTruthy();
    expect(body).toMatchObject({
      occasion: 'birthday',
      message: 'Fiesta de cumple el sábado a las 17',
      style: 'Acuarela',
      profileId: 'student-1',
    });
  });

  it('surfaces the INVALID_OUTPUT (502) envelope', async () => {
    server.use(
      http.post(`${API_BASE}/api/v1/ai/designs/generate`, () =>
        HttpResponse.json(
          {
            statusCode: 502,
            code: 'INVALID_OUTPUT',
            message: 'bad provider output',
          },
          { status: 502 },
        ),
      ),
    );

    await expect(
      requestDesignGeneration({
        occasion: 'event',
        message: 'Charla el viernes a las 18',
        style: 'Cartoon',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_OUTPUT', statusCode: 502 });
  });

  it('surfaces the CONTENT_BLOCKED (422) envelope', async () => {
    server.use(
      http.post(`${API_BASE}/api/v1/ai/designs/generate`, () =>
        HttpResponse.json(
          {
            statusCode: 422,
            code: 'CONTENT_BLOCKED',
            message: 'blocked content',
          },
          { status: 422 },
        ),
      ),
    );

    await expect(
      requestDesignGeneration({
        occasion: 'announcement',
        message: 'Aviso importante para todos',
        style: 'Realista',
      }),
    ).rejects.toMatchObject({ code: 'CONTENT_BLOCKED', statusCode: 422 });
  });

  it('propagates abort to the outgoing request', async () => {
    let seenSignal: AbortSignal | null = null;

    server.use(
      http.get(`${API_BASE}/api/v1/designs`, async ({ request }) => {
        seenSignal = request.signal;
        await new Promise((resolve) => setTimeout(resolve, 50));
        return HttpResponse.json([]);
      }),
    );

    const controller = new AbortController();
    const pending = listStudentDesigns('student-1', {
      signal: controller.signal,
    });
    // Let the request reach the handler before aborting mid-flight.
    await new Promise((resolve) => setTimeout(resolve, 10));
    controller.abort();

    await expect(pending).rejects.toThrow();
    expect(seenSignal?.aborted).toBe(true);
  });

  it('maps a design detail to a read-only library story', () => {
    const story = designDetailToStory(SAMPLE_DETAIL, 'student-1');

    expect(story).toMatchObject({
      id: 'design-1',
      title: 'Mi fiesta de cumple',
      content: 'Fiesta de cumple el sábado a las 17',
      type: 'design',
      student_id: 'student-1',
      image_url: 'https://signed.example/designs/design-1.png',
    });
  });

  it('exposes the 140-char message contract', () => {
    expect(DESIGN_MESSAGE_MAX_LENGTH).toBe(140);
  });
});
