import { ConfigService } from '@nestjs/config';
import { ModelSelectionService } from '../../application/model-selection.service';
import { InMemoryTeacherAiSettingsRepository } from '../../application/in-memory-teacher-ai-settings.repository';
import { fakePinoLogger } from '../../../observability/fake-pino-logger';
import type { OpenRouterSecretProvider } from './openrouter-client';
import { OpenRouterClient } from './openrouter-client';
import { OpenRouterImageAdapter } from './openrouter-image.adapter';

const IMAGES_URL = 'https://openrouter.ai/api/v1/images';

function buildModelSelection(
  configService: ConfigService,
): ModelSelectionService {
  return new ModelSelectionService(
    new InMemoryTeacherAiSettingsRepository(),
    configService,
    fakePinoLogger(),
  );
}

function buildAdapter(
  fetchMock: jest.Mock,
  config: Record<string, unknown> = {},
) {
  const secrets = {
    get: jest.fn().mockResolvedValue('or-test-key'),
  } as unknown as OpenRouterSecretProvider;
  const configService = new ConfigService({
    OPENROUTER_BOOK_IMAGE_MODEL: 'google/gemini-3.1-flash-image',
    ...config,
  });
  const client = new OpenRouterClient(configService, secrets);
  const adapter = new OpenRouterImageAdapter(
    client,
    buildModelSelection(configService),
  );
  jest.spyOn(globalThis, 'fetch').mockImplementation(fetchMock);

  return { adapter };
}

function imageResponse(b64: string, cost?: number): Response {
  return new Response(
    JSON.stringify({
      created: 1_700_000_000,
      data: [{ b64_json: b64, mime_type: 'image/png' }],
      ...(cost !== undefined ? { usage: { cost } } : {}),
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

describe('OpenRouterImageAdapter (SPEC-033)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('posts the Image API with the normalized subset and maps b64_json to bytes', async () => {
    const bytes = Buffer.from('fake-png-bytes');
    const fetchMock = jest
      .fn()
      .mockResolvedValue(imageResponse(bytes.toString('base64')));
    const { adapter } = buildAdapter(fetchMock);

    const result = await adapter.generate({
      prompt: 'A castle',
      aspectRatio: '1:1',
      imageSize: '1K',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      IMAGES_URL,
      expect.objectContaining({ method: 'POST' }),
    );
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const sent = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(sent).toMatchObject({
      model: 'google/gemini-3.1-flash-image',
      prompt: 'A castle',
      aspect_ratio: '1:1',
      size: '1K',
    });
    expect(sent).not.toHaveProperty('n');
    expect(sent).not.toHaveProperty('stream');
    expect(result.data.equals(bytes)).toBe(true);
    expect(result.mimeType).toBe('image/png');
    expect(result.model).toBe('google/gemini-3.1-flash-image');
  });

  it('regression: honors the design vertical env model (dead config fixed)', async () => {
    const fetchMock = jest.fn().mockResolvedValue(imageResponse('aGk='));
    const { adapter } = buildAdapter(fetchMock, {
      OPENROUTER_DESIGN_IMAGE_MODEL: 'qwen/qwen-image-3-pro',
    });

    const result = await adapter.generate({
      prompt: 'A flyer',
      vertical: 'design',
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const sent = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(sent).toMatchObject({ model: 'qwen/qwen-image-3-pro' });
    expect(result.model).toBe('qwen/qwen-image-3-pro');
  });

  it('resolves the model through ModelSelectionService with the request vertical (SPEC-033B)', async () => {
    const fetchMock = jest.fn().mockResolvedValue(imageResponse('aGk='));
    const configService = new ConfigService({});
    const secrets = {
      get: jest.fn().mockResolvedValue('or-test-key'),
    } as unknown as OpenRouterSecretProvider;
    const resolveImage = jest.fn().mockResolvedValue('openai/gpt-image-2');
    const modelSelection = {
      resolveImage,
    } as unknown as ModelSelectionService;
    const adapter = new OpenRouterImageAdapter(
      new OpenRouterClient(configService, secrets),
      modelSelection,
    );
    jest.spyOn(globalThis, 'fetch').mockImplementation(fetchMock);

    await adapter.generate({ prompt: 'hi', vertical: 'book', tenantId: 't1' });

    expect(resolveImage).toHaveBeenCalledWith('t1', 'book');
  });

  it('records the provider cost when OpenRouter reports usage.cost (SPEC-033B)', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(imageResponse('aGk=', 0.0123));
    const { adapter } = buildAdapter(fetchMock);

    const result = await adapter.generate({ prompt: 'A castle' });

    expect(result.usage?.costUsd).toBeCloseTo(0.0123, 6);
  });

  it('omits usage when the provider reports no cost', async () => {
    const fetchMock = jest.fn().mockResolvedValue(imageResponse('aGk='));
    const { adapter } = buildAdapter(fetchMock);

    const result = await adapter.generate({ prompt: 'A castle' });

    expect(result.usage).toBeUndefined();
  });

  it('throws CONTENT_BLOCKED when no image data is returned', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ created: 1, data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const { adapter } = buildAdapter(fetchMock);

    await expect(adapter.generate({ prompt: 'hi' })).rejects.toMatchObject({
      code: 'CONTENT_BLOCKED',
    });
  });

  it('maps 400 to INVALID_REQUEST', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(new Response('bad size', { status: 400 }));
    const { adapter } = buildAdapter(fetchMock);

    await expect(adapter.generate({ prompt: 'hi' })).rejects.toMatchObject({
      code: 'INVALID_REQUEST',
    });
  });

  it('maps 500 to PROVIDER_UNAVAILABLE', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(new Response('boom', { status: 500 }));
    const { adapter } = buildAdapter(fetchMock);

    await expect(adapter.generate({ prompt: 'hi' })).rejects.toMatchObject({
      code: 'PROVIDER_UNAVAILABLE',
    });
  });

  it('maps an aborted request to TIMEOUT', async () => {
    const fetchMock = jest.fn().mockImplementation(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        }),
    );
    const secrets = {
      get: jest.fn().mockResolvedValue('or-test-key'),
    } as unknown as OpenRouterSecretProvider;
    const configService = new ConfigService({});
    const client = new OpenRouterClient(configService, secrets);
    const adapter = new OpenRouterImageAdapter(
      client,
      buildModelSelection(configService),
      10,
    );
    jest.spyOn(globalThis, 'fetch').mockImplementation(fetchMock);

    await expect(adapter.generate({ prompt: 'hi' })).rejects.toMatchObject({
      code: 'TIMEOUT',
    });
  });
});
