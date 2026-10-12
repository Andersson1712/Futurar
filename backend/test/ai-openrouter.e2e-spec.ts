/**
 * SPEC-033 — Book + design generation end-to-end on OpenRouter models.
 *
 * Real OpenRouter adapters (wired by ai.module with OPENROUTER_ENABLED=true)
 * with HTTP mocked (global fetch, no network, no Redis, no real Supabase):
 * text 202 → job → book/design persisted, image bytes via storage path,
 * usage.cost recorded on the version audit, plus failure envelopes.
 */
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { BOOK_REPOSITORY } from '../src/books/book.repository';
import type { BookRepository } from '../src/books/book.repository';
import { CORRELATION_ID_HEADER } from '../src/observability/correlation-id';
import {
  E2E_CORRELATION_ID,
  E2E_TEST_TOKEN,
  E2E_TEST_USER_ID,
  VALID_BOOK_TITLE,
  VALID_DESIGN_BODY,
  VALID_DESIGN_TITLE,
  VALID_GENERATE_BODY,
  closeAiE2ETestApp,
  createAiE2ETestApp,
} from './test-app';

const AUTH_HEADER = `Bearer ${E2E_TEST_TOKEN}`;
const TEXT_MODEL = 'google/gemini-3.8-flash';
const IMAGE_MODEL = 'google/gemini-3.1-flash-image';
const BOOK_COST_USD = 0.0042;

function uniqueKey(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

interface CreatedJobBody {
  jobId: string;
  status: string;
}

function chatResponse(text: string, cost: number): Response {
  return new Response(
    JSON.stringify({
      id: 'gen-e2e',
      model: TEXT_MODEL,
      choices: [{ message: { role: 'assistant', content: text } }],
      usage: { prompt_tokens: 100, completion_tokens: 200, cost },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

function imageResponse(): Response {
  return new Response(
    JSON.stringify({
      created: 1_700_000_000,
      data: [
        { b64_json: Buffer.from('fake-openrouter-png').toString('base64') },
      ],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

const VALID_BOOK_TEXT = JSON.stringify({
  title: VALID_BOOK_TITLE,
  pages: [
    {
      pageNumber: 1,
      content: 'Habia una vez un dragon curioso que vivia en un bosque magico.',
    },
    {
      pageNumber: 2,
      content: 'El dragon encontro la estrella perdida y la devolvio al cielo.',
    },
  ],
});

const VALID_FLYER_TEXT = JSON.stringify({
  title: VALID_DESIGN_TITLE,
  message: VALID_DESIGN_BODY.message,
  imagePrompt: 'A colorful birthday flyer with balloons',
});

function mockFetch(handler: (url: string) => Response): jest.Mock {
  return jest
    .fn()
    .mockImplementation((url: string) => Promise.resolve(handler(url)));
}

describe('AI OpenRouter E2E (SPEC-033, mocked HTTP)', () => {
  let app: INestApplication<App>;
  let books: BookRepository;
  let fetchMock: jest.Mock;

  beforeAll(async () => {
    const context = await createAiE2ETestApp({ openRouterEnabled: true });
    app = context.app;
    books = app.get(BOOK_REPOSITORY);
  }, 60_000);

  beforeEach(() => {
    fetchMock = mockFetch((url: string) =>
      url.endsWith('/chat/completions')
        ? chatResponse(VALID_BOOK_TEXT, BOOK_COST_USD)
        : imageResponse(),
    );
    jest.spyOn(globalThis, 'fetch').mockImplementation(fetchMock);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await closeAiE2ETestApp(app);
  });

  function generateBook(body: unknown, key: string) {
    return request(app.getHttpServer())
      .post('/api/v1/ai/books/generate')
      .set('Authorization', AUTH_HEADER)
      .set('Idempotency-Key', key)
      .set(CORRELATION_ID_HEADER, E2E_CORRELATION_ID)
      .send(body as object);
  }

  async function pollBookId(jobId: string): Promise<string> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/ai/jobs/${jobId}`)
        .set('Authorization', AUTH_HEADER)
        .expect(200);
      const job = response.body as { status: string; bookId?: string };
      if (job.status === 'completed' && job.bookId) return job.bookId;
      if (job.status === 'failed') throw new Error(`Job ${jobId} failed`);
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`Job ${jobId} did not complete`);
  }

  it('033-5 runs book generation on the pinned OpenRouter text model with cost', async () => {
    const created = await generateBook(
      VALID_GENERATE_BODY,
      uniqueKey('or-book'),
    ).expect(202);
    const createdBody = created.body as CreatedJobBody;
    expect(createdBody.status).toBe('completed');

    const chatCalls = fetchMock.mock.calls as Array<[string, RequestInit]>;
    const chatCall = chatCalls.find(([url]) =>
      url.endsWith('/chat/completions'),
    );
    expect(chatCall).toBeDefined();
    const [, init] = chatCall as [string, RequestInit];
    const sent = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(sent).toMatchObject({
      model: TEXT_MODEL,
      response_format: {
        type: 'json_schema',
        json_schema: { strict: true },
      },
      provider: { require_parameters: true },
    });

    const stored = await books.findById(
      await pollBookId(createdBody.jobId),
      E2E_TEST_USER_ID,
    );
    expect(stored?.version.audit.model).toBe(TEXT_MODEL);
    expect(
      (stored?.version.audit as unknown as { costUsd?: number })?.costUsd,
    ).toBeCloseTo(BOOK_COST_USD, 6);
  });

  it('033-5 runs design generation with OpenRouter text and image', async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        url.endsWith('/chat/completions')
          ? chatResponse(VALID_FLYER_TEXT, 0.001)
          : imageResponse(),
      ),
    );

    const created = await request(app.getHttpServer())
      .post('/api/v1/ai/designs/generate')
      .set('Authorization', AUTH_HEADER)
      .set('Idempotency-Key', uniqueKey('or-design'))
      .set(CORRELATION_ID_HEADER, E2E_CORRELATION_ID)
      .send(VALID_DESIGN_BODY)
      .expect(202);
    const createdBody = created.body as CreatedJobBody;
    expect(createdBody.status).toBe('completed');

    const imageCalls = fetchMock.mock.calls as Array<[string, RequestInit]>;
    const imageCall = imageCalls.find(([url]) => url.endsWith('/images'));
    expect(imageCall).toBeDefined();
    const [, imageInit] = imageCall as [string, RequestInit];
    const imageSent = JSON.parse(imageInit.body as string) as Record<
      string,
      unknown
    >;
    expect(imageSent).toMatchObject({
      model: IMAGE_MODEL,
      aspect_ratio: '1:1',
      size: '1K',
    });
  });

  it('033-5 maps a provider 500 to PROVIDER_UNAVAILABLE with no partial book', async () => {
    const before = await books.listByUser(E2E_TEST_USER_ID);
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response('upstream boom', { status: 500 })),
    );

    const response = await generateBook(
      VALID_GENERATE_BODY,
      uniqueKey('or-500'),
    ).expect(503);
    expect(response.body).toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });

    const after = await books.listByUser(E2E_TEST_USER_ID);
    expect(after.length).toBe(before.length);
  });

  it('033-5 maps bad schema output to INVALID_OUTPUT (502)', async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        url.endsWith('/chat/completions')
          ? chatResponse('not json at all', 0)
          : imageResponse(),
      ),
    );

    const response = await generateBook(
      VALID_GENERATE_BODY,
      uniqueKey('or-invalid'),
    ).expect(502);
    expect(response.body).toMatchObject({ code: 'INVALID_OUTPUT' });
  });
});
