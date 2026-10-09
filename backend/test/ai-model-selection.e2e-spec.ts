/**
 * SPEC-033B — per-teacher AI model selection end-to-end (mocked HTTP).
 *
 * Real OpenRouter adapters (wired by ai.module with OPENROUTER_ENABLED=true),
 * in-memory teacher settings (SupabaseService client forced to null), HTTP
 * mocked via global fetch. Covers the catalog read, preference roundtrip,
 * 422 INVALID_MODEL on an unknown slug, and that a selected model is applied
 * to the next generation.
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
const TEXT_MODEL = 'google/gemini-3.8-flash';
const IMAGE_MODEL = 'google/gemini-3.1-flash-image';
const IMAGE_ALT = 'qwen/qwen-image-3-pro';

const VALID_FLYER_TEXT = JSON.stringify({
  title: VALID_DESIGN_TITLE,
  message: VALID_DESIGN_BODY.message,
  imagePrompt: 'A colorful birthday flyer with balloons',
});

function uniqueKey(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

function chatResponse(text: string, cost: number): Response {
  return new Response(
    JSON.stringify({
      id: 'gen-e2e',
      model: TEXT_MODEL,
      choices: [{ message: { role: 'assistant', content: text } }],
      usage: { prompt_tokens: 10, completion_tokens: 20, cost },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

function imageResponse(): Response {
  return new Response(
    JSON.stringify({
      created: 1_700_000_000,
      data: [{ b64_json: Buffer.from('e2e-model-png').toString('base64') }],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

describe('AI model selection E2E (SPEC-033B, mocked HTTP)', () => {
  let app: INestApplication<App>;
  let fetchMock: jest.Mock;

  beforeAll(async () => {
    const context = await createAiE2ETestApp({ openRouterEnabled: true });
    app = context.app;
  }, 60_000);

  beforeEach(() => {
    fetchMock = jest
      .fn()
      .mockImplementation((url: string) =>
        Promise.resolve(
          url.endsWith('/chat/completions')
            ? chatResponse(VALID_FLYER_TEXT, 0.001)
            : imageResponse(),
        ),
      );
    jest.spyOn(globalThis, 'fetch').mockImplementation(fetchMock);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await closeAiE2ETestApp(app);
  });

  it('033B-4 returns the curated catalog with defaults', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/ai/models')
      .set('Authorization', AUTH_HEADER)
      .expect(200);

    expect(response.body).toEqual({
      text: [TEXT_MODEL],
      image: [IMAGE_MODEL, 'openai/gpt-image-2', IMAGE_ALT],
      defaults: { text: TEXT_MODEL, image: IMAGE_MODEL },
    });
  });

  it('033B-4 returns defaults when no preference is stored', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/ai/model-preferences')
      .set('Authorization', AUTH_HEADER)
      .expect(200);

    expect(response.body).toEqual({
      textModel: TEXT_MODEL,
      imageModel: IMAGE_MODEL,
    });
  });

  it('033B-4 persists a preference and reads it back', async () => {
    const saved = await request(app.getHttpServer())
      .put('/api/v1/ai/model-preferences')
      .set('Authorization', AUTH_HEADER)
      .send({ textModel: TEXT_MODEL, imageModel: IMAGE_ALT })
      .expect(200);

    expect(saved.body).toEqual({
      textModel: TEXT_MODEL,
      imageModel: IMAGE_ALT,
    });

    const read = await request(app.getHttpServer())
      .get('/api/v1/ai/model-preferences')
      .set('Authorization', AUTH_HEADER)
      .expect(200);

    expect(read.body).toEqual({ textModel: TEXT_MODEL, imageModel: IMAGE_ALT });
  });

  it('033B-4 rejects an unknown slug with 422 INVALID_MODEL and persists nothing', async () => {
    const response = await request(app.getHttpServer())
      .put('/api/v1/ai/model-preferences')
      .set('Authorization', AUTH_HEADER)
      .send({ textModel: 'evil/not-a-model' })
      .expect(422);

    expect(response.body).toMatchObject({ code: 'INVALID_MODEL' });

    const read = await request(app.getHttpServer())
      .get('/api/v1/ai/model-preferences')
      .set('Authorization', AUTH_HEADER)
      .expect(200);

    expect(read.body).toEqual({ textModel: TEXT_MODEL, imageModel: IMAGE_ALT });
  });

  it('033B-4 applies the selected image model to the next generation', async () => {
    await request(app.getHttpServer())
      .put('/api/v1/ai/model-preferences')
      .set('Authorization', AUTH_HEADER)
      .send({ imageModel: IMAGE_ALT })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/ai/designs/generate')
      .set('Authorization', AUTH_HEADER)
      .set('Idempotency-Key', uniqueKey('model-design'))
      .set(CORRELATION_ID_HEADER, E2E_CORRELATION_ID)
      .send(VALID_DESIGN_BODY)
      .expect(202);

    const imageCall = (
      fetchMock.mock.calls as Array<[string, RequestInit]>
    ).find(([url]) => url.endsWith('/images'));
    expect(imageCall).toBeDefined();
    const [, init] = imageCall as [string, RequestInit];
    const sent = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(sent).toMatchObject({ model: IMAGE_ALT });
  });
});
