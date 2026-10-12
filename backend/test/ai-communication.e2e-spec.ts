/**
 * SPEC-029C — Board flow E2E with the Gemini provider mocked.
 *
 * Proves together (no network, no Redis, no real Supabase):
 * generate (202) → job poll → persisted board with text + per-cell images,
 * plus failure envelopes, idempotent replay, and the board kill-switches.
 */
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { CORRELATION_ID_HEADER } from '../src/observability/correlation-id';
import {
  E2E_CORRELATION_ID,
  E2E_TEST_TOKEN,
  VALID_COMMUNICATION_BODY,
  VALID_COMMUNICATION_TITLE,
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

function buildValidBoard() {
  return {
    title: VALID_COMMUNICATION_TITLE,
    cells: [
      { label: 'Contento', imagePrompt: 'A happy face pictogram' },
      { label: 'Triste', imagePrompt: 'A sad face pictogram' },
      { label: 'Cansado', imagePrompt: 'A tired face pictogram' },
      { label: 'Enojado', imagePrompt: 'An angry face pictogram' },
      { label: 'Tranquilo', imagePrompt: 'A calm face pictogram' },
      { label: 'Con miedo', imagePrompt: 'A scared face pictogram' },
    ],
  };
}

function mockValidBoard(mockTextGenerate: jest.Mock): void {
  mockTextGenerate.mockResolvedValue({
    text: JSON.stringify(buildValidBoard()),
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

describe('AI board E2E (SPEC-029C, mocked provider)', () => {
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
    mockValidBoard(mockTextGenerate);
    mockImageOk(mockImageGenerate);
  });

  afterAll(async () => {
    await closeAiE2ETestApp(app);
  });

  function generate(body: unknown, key: string) {
    return request(app.getHttpServer())
      .post('/api/v1/ai/communications/generate')
      .set('Authorization', AUTH_HEADER)
      .set('Idempotency-Key', key)
      .set(CORRELATION_ID_HEADER, E2E_CORRELATION_ID)
      .send(body as object);
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

  it('029C-3 runs generate → job → board with text and images', async () => {
    const created = await generate(VALID_COMMUNICATION_BODY, uniqueKey('happy'))
      .expect(202)
      .expect(CORRELATION_ID_HEADER, E2E_CORRELATION_ID);
    const createdBody = created.body as CreatedJobBody;

    expect(createdBody.jobId).toEqual(expect.any(String));
    expect(createdBody.status).toBe('completed');

    const job = await pollJobUntilTerminal(createdBody.jobId);
    expect(job.status).toBe('completed');
    expect(job.bookId).toEqual(expect.any(String));
    expect(job.book?.title).toBe(VALID_COMMUNICATION_TITLE);

    const boardId = job.bookId ?? '';
    const board = await request(app.getHttpServer())
      .get(`/api/v1/communications/${boardId}`)
      .set('Authorization', AUTH_HEADER)
      .expect(200);

    expect(board.body as Record<string, unknown>).toMatchObject({
      id: boardId,
      title: VALID_COMMUNICATION_TITLE,
      kind: VALID_COMMUNICATION_BODY.kind,
      cellCount: 6,
    });
    // Every cell carries a signed URL minted on read from its own path.
    const detail = board.body as {
      cells: { imageUrl?: unknown }[];
    };
    expect(detail.cells).toHaveLength(6);
    for (const cell of detail.cells) {
      expect(typeof cell.imageUrl).toBe('string');
      expect(cell.imageUrl as string).toContain('storage.test/communications/');
    }

    const listed = await request(app.getHttpServer())
      .get('/api/v1/communications')
      .set('Authorization', AUTH_HEADER)
      .expect(200);
    expect(listed.body as unknown[]).toHaveLength(1);

    await request(app.getHttpServer())
      .delete(`/api/v1/communications/${boardId}`)
      .set('Authorization', AUTH_HEADER)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/v1/communications/${boardId}`)
      .set('Authorization', AUTH_HEADER)
      .expect(404);

    const empty = await request(app.getHttpServer())
      .get('/api/v1/communications')
      .set('Authorization', AUTH_HEADER)
      .expect(200);
    expect(empty.body).toHaveLength(0);
  });

  it('029C-3 maps invalid provider output to INVALID_OUTPUT (502)', async () => {
    mockTextGenerate.mockResolvedValueOnce({
      text: 'not json at all',
      model: 'e2e-mock-model',
    });

    const response = await generate(
      VALID_COMMUNICATION_BODY,
      uniqueKey('invalid'),
    ).expect(502);

    expect(response.body).toMatchObject({ code: 'INVALID_OUTPUT' });
  });

  it('029C-3 rejects a board with the wrong cell count (502)', async () => {
    mockTextGenerate.mockResolvedValueOnce({
      text: JSON.stringify({
        ...buildValidBoard(),
        cells: buildValidBoard().cells.slice(0, 4),
      }),
      model: 'e2e-mock-model',
    });

    const response = await generate(
      VALID_COMMUNICATION_BODY,
      uniqueKey('count'),
    ).expect(502);

    expect(response.body).toMatchObject({ code: 'INVALID_OUTPUT' });
  });

  it('029C-3 maps blocked generated content to CONTENT_BLOCKED (422)', async () => {
    const board = buildValidBoard();
    mockTextGenerate.mockResolvedValueOnce({
      text: JSON.stringify({
        ...board,
        cells: board.cells.map((cell, index) =>
          index === 0 ? { ...cell, label: 'Sangre y violencia' } : cell,
        ),
      }),
      model: 'e2e-mock-model',
    });

    const response = await generate(
      VALID_COMMUNICATION_BODY,
      uniqueKey('blocked'),
    ).expect(422);

    expect(response.body).toMatchObject({ code: 'CONTENT_BLOCKED' });
  });

  it('029C-3 replays the same Idempotency-Key without duplicating work', async () => {
    const key = uniqueKey('idempotent');
    const callsBefore = mockTextGenerate.mock.calls.length;

    const first = await generate(VALID_COMMUNICATION_BODY, key).expect(202);
    const replay = await generate(VALID_COMMUNICATION_BODY, key).expect(202);

    expect(replay.body).toEqual(first.body);
    expect(mockTextGenerate.mock.calls.length - callsBefore).toBe(1);

    await generate(
      { ...VALID_COMMUNICATION_BODY, topic: 'Otro tema distinto' },
      key,
    ).expect(409);
  });

  it('029C-3 rejects a topic over 120 chars with 400 (never truncates)', async () => {
    const callsBefore = mockTextGenerate.mock.calls.length;

    await generate(
      { ...VALID_COMMUNICATION_BODY, topic: 'x'.repeat(121) },
      uniqueKey('long'),
    )
      .expect(400)
      .then((response) => {
        expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
      });

    expect(mockTextGenerate.mock.calls.length - callsBefore).toBe(0);
  });

  it('029C-3 rejects an unsupported cell count with 400', async () => {
    await generate(
      { ...VALID_COMMUNICATION_BODY, cellCount: 5 },
      uniqueKey('count-400'),
    ).expect(400);

    expect(mockTextGenerate).not.toHaveBeenCalled();
  });

  it('029C-3 fails the job without a partial board when an image fails', async () => {
    const before = await request(app.getHttpServer())
      .get('/api/v1/communications')
      .set('Authorization', AUTH_HEADER)
      .expect(200);

    mockImageGenerate.mockRejectedValueOnce(new Error('image boom'));

    await generate(VALID_COMMUNICATION_BODY, uniqueKey('image-fail'))
      .expect(500)
      .then((response) => {
        expect(response.body).toMatchObject({ code: 'INTERNAL' });
      });

    // No partial persist: every cell image is required, so the failed run
    // stores nothing (other tests may own boards in this shared app).
    const after = await request(app.getHttpServer())
      .get('/api/v1/communications')
      .set('Authorization', AUTH_HEADER)
      .expect(200);
    expect((after.body as unknown[]).length).toBe(
      (before.body as unknown[]).length,
    );
  });

  describe('board kill-switches', () => {
    let imagesOffApp: INestApplication<App> | undefined;
    let endpointsOffApp: INestApplication<App> | undefined;

    afterAll(async () => {
      await closeAiE2ETestApp(imagesOffApp);
      await closeAiE2ETestApp(endpointsOffApp);
    });

    it('returns 501 when COMMUNICATION_IMAGES_ENABLED is false', async () => {
      const context = await createAiE2ETestApp({
        communicationImagesEnabled: false,
      });
      imagesOffApp = context.app;
      context.mockTextGenerate.mockResolvedValue({
        text: JSON.stringify(buildValidBoard()),
        model: 'e2e-mock-model',
      });

      await request(context.app.getHttpServer())
        .post('/api/v1/ai/communications/generate')
        .set('Authorization', AUTH_HEADER)
        .set('Idempotency-Key', uniqueKey('images-off'))
        .send(VALID_COMMUNICATION_BODY)
        .expect(501)
        .then((response) => {
          expect(response.body).toMatchObject({ code: 'NOT_IMPLEMENTED' });
        });

      expect(context.mockTextGenerate).not.toHaveBeenCalled();
    });

    it('returns 501 when COMMUNICATION_ENDPOINTS_ENABLED is false', async () => {
      const context = await createAiE2ETestApp({
        communicationEndpointsEnabled: false,
      });
      endpointsOffApp = context.app;

      await request(context.app.getHttpServer())
        .post('/api/v1/ai/communications/generate')
        .set('Authorization', AUTH_HEADER)
        .set('Idempotency-Key', uniqueKey('endpoints-off'))
        .send(VALID_COMMUNICATION_BODY)
        .expect(501)
        .then((response) => {
          expect(response.body).toMatchObject({ code: 'NOT_IMPLEMENTED' });
        });

      expect(context.mockTextGenerate).not.toHaveBeenCalled();
    });
  });
});
