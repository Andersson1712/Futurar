/**
 * SPEC-031B — Flyer PDF export E2E with the Gemini provider mocked.
 *
 * Proves together (no network, no Redis, no real Supabase):
 * design generate → export request (202) → job poll → download URL for a
 * real PDF artifact in mocked storage, plus failure envelopes and the
 * export kill-switch.
 */
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { CORRELATION_ID_HEADER } from '../src/observability/correlation-id';
import {
  E2E_CORRELATION_ID,
  E2E_TEST_TOKEN,
  VALID_DESIGN_BODY,
  VALID_DESIGN_TITLE,
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

function mockValidFlyer(mockTextGenerate: jest.Mock): void {
  mockTextGenerate.mockResolvedValue({
    text: JSON.stringify({
      title: VALID_DESIGN_TITLE,
      message: VALID_DESIGN_BODY.message,
      imagePrompt: 'A colorful birthday flyer with balloons',
    }),
    model: 'e2e-mock-model',
    usage: { inputTokens: 10, outputTokens: 20 },
  });
}

function mockImageOk(mockImageGenerate: jest.Mock): void {
  mockImageGenerate.mockResolvedValue({
    data: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    ),
    mimeType: 'image/png',
    model: 'e2e-mock-image-model',
  });
}

describe('Flyer PDF export E2E (SPEC-031B, mocked provider)', () => {
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
    mockValidFlyer(mockTextGenerate);
    mockImageOk(mockImageGenerate);
  });

  afterAll(async () => {
    await closeAiE2ETestApp(app);
  });

  async function createDesign(): Promise<string> {
    const created = await request(app.getHttpServer())
      .post('/api/v1/ai/designs/generate')
      .set('Authorization', AUTH_HEADER)
      .set('Idempotency-Key', uniqueKey('design'))
      .set(CORRELATION_ID_HEADER, E2E_CORRELATION_ID)
      .send({ ...VALID_DESIGN_BODY })
      .expect(202);

    const createdBody = created.body as CreatedJobBody;

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/ai/jobs/${createdBody.jobId}`)
        .set('Authorization', AUTH_HEADER)
        .expect(200);
      const job = response.body as PolledJobBody;
      if (job.status === 'completed') return job.bookId ?? '';
      if (job.status === 'failed') throw new Error('design job failed');
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    throw new Error('design job did not complete');
  }

  function exportDesign(designId: string, body: unknown, key: string) {
    return request(app.getHttpServer())
      .post(`/api/v1/exports/designs/${designId}`)
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

  it('031B-2 runs export → job → flyer PDF download URL', async () => {
    const designId = await createDesign();
    expect(designId).toEqual(expect.any(String));

    const created = await exportDesign(
      designId,
      { format: 'pdf' },
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
    expect(body.downloadUrl as string).toContain('/flyer.pdf');
  });

  it('031B-2 returns 404 for an unknown design', async () => {
    await exportDesign(randomUUID(), { format: 'pdf' }, uniqueKey('missing'))
      .expect(404)
      .then((response) => {
        expect(response.body).toMatchObject({ code: 'NOT_FOUND' });
      });
  });

  it('031B-2 rejects a mismatched format and target with 400', async () => {
    const designId = await createDesign();

    // PDF is a design-only format: asking it for a book id is rejected.
    await request(app.getHttpServer())
      .post(`/api/v1/exports/books/${designId}`)
      .set('Authorization', AUTH_HEADER)
      .set('Idempotency-Key', uniqueKey('mismatch'))
      .send({ format: 'pdf' })
      .expect(400)
      .then((response) => {
        expect(response.body).toMatchObject({ code: 'INVALID_REQUEST' });
      });
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
        .post(`/api/v1/exports/designs/${randomUUID()}`)
        .set('Authorization', AUTH_HEADER)
        .set('Idempotency-Key', uniqueKey('off'))
        .send({ format: 'pdf' })
        .expect(501)
        .then((response) => {
          expect(response.body).toMatchObject({ code: 'NOT_IMPLEMENTED' });
        });
    });
  });
});
