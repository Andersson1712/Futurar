/**
 * SPEC-031 — Book export E2E with the Gemini provider mocked.
 *
 * Proves together (no network, no Redis, no real Supabase):
 * book generate → export request (202) → job poll → download URL for a
 * real EPUB artifact in mocked storage, plus failure envelopes, idempotent
 * replay, and the export kill-switch.
 */
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { CORRELATION_ID_HEADER } from '../src/observability/correlation-id';
import {
  E2E_CORRELATION_ID,
  E2E_TEST_TOKEN,
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

function mockValidBook(mockTextGenerate: jest.Mock): void {
  mockTextGenerate.mockResolvedValue({
    text: JSON.stringify({
      title: VALID_BOOK_TITLE,
      pages: [
        {
          pageNumber: 1,
          content:
            'Habia una vez un dragon curioso que vivia en un bosque magico.',
          imagePrompt: 'a curious dragon in a magical forest',
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
}

function mockImageOk(mockImageGenerate: jest.Mock): void {
  mockImageGenerate.mockResolvedValue({
    data: Buffer.from('fake-png-bytes'),
    mimeType: 'image/png',
    model: 'e2e-mock-image-model',
  });
}

describe('Book export E2E (SPEC-031, mocked provider)', () => {
  let app: INestApplication<App>;
  let mockTextGenerate: jest.Mock;
  let mockImageGenerate: jest.Mock;

  beforeAll(async () => {
    const context = await createAiE2ETestApp();
    app = context.app;
    mockTextGenerate = context.mockTextGenerate;
    mockImageGenerate = context.mockImageGenerate;
  }, 60_000);

  beforeEach(() => {
    mockTextGenerate.mockReset();
    mockImageGenerate.mockReset();
    mockValidBook(mockTextGenerate);
    mockImageOk(mockImageGenerate);
  });

  afterAll(async () => {
    await closeAiE2ETestApp(app);
  });

  async function createBook(): Promise<string> {
    const created = await request(app.getHttpServer())
      .post('/api/v1/ai/books/generate')
      .set('Authorization', AUTH_HEADER)
      .set('Idempotency-Key', uniqueKey('book'))
      .set(CORRELATION_ID_HEADER, E2E_CORRELATION_ID)
      .send({ ...VALID_GENERATE_BODY })
      .expect(202);

    const createdBody = created.body as CreatedJobBody;

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/ai/jobs/${createdBody.jobId}`)
        .set('Authorization', AUTH_HEADER)
        .expect(200);
      const job = response.body as PolledJobBody;
      if (job.status === 'completed') return job.bookId ?? '';
      if (job.status === 'failed') throw new Error('book job failed');
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    throw new Error('book job did not complete');
  }

  function exportBook(bookId: string, body: unknown, key: string) {
    return request(app.getHttpServer())
      .post(`/api/v1/exports/books/${bookId}`)
      .set('Authorization', AUTH_HEADER)
      .set('Idempotency-Key', key)
      .set(CORRELATION_ID_HEADER, E2E_CORRELATION_ID)
      .send(body as object);
  }

  async function pollExportJob(jobId: string): Promise<PolledJobBody> {
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

  it('031-3 runs export → job → EPUB download URL', async () => {
    const bookId = await createBook();
    expect(bookId).toEqual(expect.any(String));

    const created = await exportBook(
      bookId,
      { format: 'epub' },
      uniqueKey('happy'),
    )
      .expect(202)
      .expect(CORRELATION_ID_HEADER, E2E_CORRELATION_ID);
    const createdBody = created.body as CreatedJobBody;

    expect(createdBody.jobId).toEqual(expect.any(String));
    expect(createdBody.status).toBe('completed');

    const job = await pollExportJob(createdBody.jobId);
    expect(job.status).toBe('completed');

    const download = await request(app.getHttpServer())
      .get(`/api/v1/exports/${createdBody.jobId}/download`)
      .set('Authorization', AUTH_HEADER)
      .expect(200);

    const body = download.body as { downloadUrl?: unknown };
    expect(typeof body.downloadUrl).toBe('string');
    expect(body.downloadUrl as string).toContain('storage.test/exports/');
    expect(body.downloadUrl as string).toContain('/book.epub');
  });

  it('031-3 returns 404 for an unknown book', async () => {
    await exportBook(randomUUID(), { format: 'epub' }, uniqueKey('missing'))
      .expect(404)
      .then((response) => {
        expect(response.body).toMatchObject({ code: 'NOT_FOUND' });
      });
  });

  it('031-3 rejects an unsupported format with 400', async () => {
    const bookId = await createBook();

    await exportBook(bookId, { format: 'mobi' }, uniqueKey('format'))
      .expect(400)
      .then((response) => {
        expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
      });
  });

  it('031-3 replays the same Idempotency-Key without duplicating work', async () => {
    const bookId = await createBook();
    const key = uniqueKey('idempotent');

    const first = await exportBook(bookId, { format: 'epub' }, key).expect(202);
    const replay = await exportBook(bookId, { format: 'epub' }, key).expect(
      202,
    );

    expect(replay.body).toEqual(first.body);
  });

  it('031-3 returns 404 when downloading an unknown job', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/exports/${randomUUID()}/download`)
      .set('Authorization', AUTH_HEADER)
      .expect(404);
  });

  describe('export kill-switch', () => {
    let offApp: INestApplication<App> | undefined;

    afterAll(async () => {
      await closeAiE2ETestApp(offApp);
    });

    it('returns 501 when EXPORTS_ENABLED is false', async () => {
      const context = await createAiE2ETestApp({ exportsEnabled: false });
      offApp = context.app;

      await request(context.app.getHttpServer())
        .post(`/api/v1/exports/books/${randomUUID()}`)
        .set('Authorization', AUTH_HEADER)
        .set('Idempotency-Key', uniqueKey('off'))
        .send({ format: 'epub' })
        .expect(501)
        .then((response) => {
          expect(response.body).toMatchObject({ code: 'NOT_IMPLEMENTED' });
        });
    });
  });
});
