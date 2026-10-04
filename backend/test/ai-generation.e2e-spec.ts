/**
 * SPEC-028 — Full generation flow E2E with the Gemini provider mocked.
 *
 * Proves together (no network, no Redis, no real Supabase):
 * generate (202) → job poll → SSE terminal close → persisted book,
 * plus failure envelopes, idempotent replay, and observability.
 */
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { CORRELATION_ID_HEADER } from '../src/observability/correlation-id';
import {
  E2E_CORRELATION_ID,
  E2E_TEST_TOKEN,
  E2E_TEST_USER_ID,
  VALID_BOOK_TITLE,
  VALID_GENERATE_BODY,
  closeAiE2ETestApp,
  createAiE2ETestApp,
} from './test-app';

const AUTH_HEADER = `Bearer ${E2E_TEST_TOKEN}`;

function uniqueKey(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

interface CreatedJobBody {
  jobId: string;
  status: string;
}

interface PolledJobBody {
  status: string;
  bookId?: string;
  book?: { title?: string };
}

describe('AI generation E2E (SPEC-028, mocked provider)', () => {
  let app: INestApplication<App>;
  let mockTextGenerate: jest.Mock;

  beforeAll(async () => {
    const context = await createAiE2ETestApp();
    app = context.app;
    mockTextGenerate = context.mockTextGenerate;
  }, 60_000);

  beforeEach(() => {
    mockTextGenerate.mockReset();
    mockTextGenerate.mockResolvedValue({
      text: JSON.stringify({
        title: VALID_BOOK_TITLE,
        pages: [
          {
            pageNumber: 1,
            content:
              'Habia una vez un dragon curioso que vivia en un bosque magico.',
          },
          {
            pageNumber: 2,
            content:
              'El dragon encontro la estrella perdida y la devolvio al cielo.',
          },
        ],
      }),
      model: 'e2e-mock-model',
      usage: { inputTokens: 10, outputTokens: 20 },
    });
  });

  afterAll(async () => {
    await closeAiE2ETestApp(app);
  });

  // NOTE: intentionally NOT async — supertest chains are thenable, so an
  // async wrapper would fire the request before .expect() is attached and
  // orphan it against teardown ("SuperTest server closed before listening").
  function generate(body: unknown, key: string, extra = {}) {
    return request(app.getHttpServer())
      .post('/api/v1/ai/books/generate')
      .set('Authorization', AUTH_HEADER)
      .set('Idempotency-Key', key)
      .set(CORRELATION_ID_HEADER, E2E_CORRELATION_ID)
      .send({ ...extra, ...(body as object) });
  }

  async function pollJobUntilTerminal(jobId: string): Promise<PolledJobBody> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/ai/jobs/${jobId}`)
        .set('Authorization', AUTH_HEADER)
        .expect(200);
      const job = response.body as PolledJobBody;
      if (job.status === 'completed' || job.status === 'failed') return job;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`Job ${jobId} did not reach a terminal state`);
  }

  it('028-2 runs generate → job → book with the inline queue', async () => {
    const created = await generate(VALID_GENERATE_BODY, uniqueKey('happy'))
      .expect(202)
      .expect(CORRELATION_ID_HEADER, E2E_CORRELATION_ID);
    const createdBody = created.body as CreatedJobBody;

    expect(createdBody.jobId).toEqual(expect.any(String));
    expect(createdBody.status).toBe('completed');

    const job = await pollJobUntilTerminal(createdBody.jobId);
    expect(job.status).toBe('completed');
    expect(job.bookId).toEqual(expect.any(String));
    expect(job.book?.title).toBe(VALID_BOOK_TITLE);

    const bookId = job.bookId ?? '';
    const book = await request(app.getHttpServer())
      .get(`/api/v1/books/${bookId}`)
      .set('Authorization', AUTH_HEADER)
      .expect(200);

    expect(book.body as Record<string, unknown>).toMatchObject({
      id: bookId,
      title: VALID_BOOK_TITLE,
      totalPages: 2,
    });
    expect(E2E_TEST_USER_ID).toBe('e2e-user-1');
  });

  // 028-2 SSE terminal close: the stream must end after the terminal
  // status is emitted (supertest resolving at all proves the close).
  // Header auth via supertest: EventSource cannot send auth headers, so the
  // polling fallback in pollJobUntilTerminal stays the supported client path.
  it('028-2 closes the SSE stream on the terminal job', async () => {
    const created = await generate(
      VALID_GENERATE_BODY,
      uniqueKey('sse'),
    ).expect(202);
    const jobId = (created.body as CreatedJobBody).jobId;

    const events = await request(app.getHttpServer())
      .get(`/api/v1/ai/jobs/${jobId}/events`)
      .set('Authorization', AUTH_HEADER)
      .set('Accept', 'text/event-stream')
      .expect(200);

    expect(events.headers['content-type']).toContain('text/event-stream');
    // supertest resolving at all proves the terminal close: the stream only
    // ends after the completed status is emitted.
    expect(events.text).toContain('completed');

    const polled = await pollJobUntilTerminal(jobId);
    expect(polled.status).toBe('completed');
  });

  it('028-2 rejects SSE without auth and for unknown jobs', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/ai/jobs/does-not-exist/events')
      .set('Accept', 'text/event-stream')
      .expect(401);

    await request(app.getHttpServer())
      .get('/api/v1/ai/jobs/does-not-exist/events')
      .set('Authorization', AUTH_HEADER)
      .set('Accept', 'text/event-stream')
      .expect(404);
  });

  it('028-3 maps invalid provider output to INVALID_OUTPUT (502)', async () => {
    mockTextGenerate.mockResolvedValueOnce({
      text: 'not json at all',
      model: 'e2e-mock-model',
    });

    const response = await generate(
      VALID_GENERATE_BODY,
      uniqueKey('invalid'),
    ).expect(502);

    expect(response.body).toMatchObject({ code: 'INVALID_OUTPUT' });
  });

  it('028-3 maps blocked generated content to CONTENT_BLOCKED (422)', async () => {
    mockTextGenerate.mockResolvedValueOnce({
      text: JSON.stringify({
        title: 'Sangre en el bosque',
        pages: [{ pageNumber: 1, content: 'Una historia tranquila.' }],
      }),
      model: 'e2e-mock-model',
    });

    const response = await generate(
      VALID_GENERATE_BODY,
      uniqueKey('blocked'),
    ).expect(422);

    expect(response.body).toMatchObject({ code: 'CONTENT_BLOCKED' });
  });

  it('028-3 replays the same Idempotency-Key without duplicating work', async () => {
    const key = uniqueKey('idempotent');
    const callsBefore = mockTextGenerate.mock.calls.length;

    const first = await generate(VALID_GENERATE_BODY, key).expect(202);
    const replay = await generate(VALID_GENERATE_BODY, key).expect(202);

    expect(replay.body).toEqual(first.body);
    expect(mockTextGenerate.mock.calls.length - callsBefore).toBe(1);

    // Same key with a different payload is a conflict, not a replay.
    await generate(
      { ...VALID_GENERATE_BODY, mission: 'Una mision distinta' },
      key,
    ).expect(409);
  });

  it('028-3 triangulates error envelopes (400/404/401)', async () => {
    await generate({ protagonist: 'Solo el protagonista' }, uniqueKey('bad'))
      .expect(400)
      .then((response) => {
        expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
      });

    await request(app.getHttpServer())
      .post('/api/v1/ai/books/generate')
      .set('Authorization', AUTH_HEADER)
      .send(VALID_GENERATE_BODY)
      .expect(400)
      .then((response) => {
        expect(response.body).toMatchObject({
          code: 'IDEMPOTENCY_KEY_REQUIRED',
        });
      });

    await request(app.getHttpServer())
      .get('/api/v1/ai/jobs/does-not-exist')
      .set('Authorization', AUTH_HEADER)
      .expect(404)
      .then((response) => {
        expect(response.body).toMatchObject({ code: 'NOT_FOUND' });
      });

    await request(app.getHttpServer())
      .get('/api/v1/ai/jobs/does-not-exist')
      .expect(401);
  });

  it('028-4 echoes the correlation id and keeps health public', async () => {
    const created = await generate(VALID_GENERATE_BODY, uniqueKey('corr'))
      .expect(202)
      .expect(CORRELATION_ID_HEADER, E2E_CORRELATION_ID);
    expect((created.body as CreatedJobBody).jobId).toEqual(expect.any(String));

    const health = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);

    // Redis is intentionally down in this suite: the probe must stay public
    // and report the disabled driver instead of crashing.
    expect(health.body).toMatchObject({
      status: 'ok',
      redis: 'disabled',
      queueDriver: 'inline',
    });
    expect(health.headers[CORRELATION_ID_HEADER]).toBeDefined();
  });

  it('028-4 keeps metrics behind auth and passes with Redis down', async () => {
    await request(app.getHttpServer()).get('/api/v1/metrics').expect(401);

    const snapshot = await request(app.getHttpServer())
      .get('/api/v1/metrics')
      .set('Authorization', AUTH_HEADER)
      .expect(200);

    const metrics = snapshot.body as {
      generation: { jobs: number };
    };
    expect(metrics.generation.jobs).toBeGreaterThan(0);

    // Redis-down proof: the full generate flow above already ran with
    // REDIS_CLIENT=null; this call re-proves generation still works.
    const created = await generate(
      VALID_GENERATE_BODY,
      uniqueKey('noredis'),
    ).expect(202);
    expect((created.body as CreatedJobBody).status).toBe('completed');
  });
});
