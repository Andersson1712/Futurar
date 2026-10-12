import { ConfigService } from '@nestjs/config';
import { AiProviderError } from '../../ai.errors';
import { ModelSelectionService } from '../../application/model-selection.service';
import { InMemoryTeacherAiSettingsRepository } from '../../application/in-memory-teacher-ai-settings.repository';
import { fakePinoLogger } from '../../../observability/fake-pino-logger';
import type { OpenRouterSecretProvider } from './openrouter-client';
import { OpenRouterClient } from './openrouter-client';
import { OpenRouterTextAdapter } from './openrouter-text.adapter';

const CHAT_COMPLETIONS_URL = 'https://openrouter.ai/api/v1/chat/completions';

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
    OPENROUTER_BOOK_TEXT_MODEL: 'google/gemini-3.8-flash',
    ...config,
  });
  const client = new OpenRouterClient(configService, secrets);
  const adapter = new OpenRouterTextAdapter(
    client,
    buildModelSelection(configService),
  );
  const fetchSpy = jest
    .spyOn(globalThis, 'fetch')
    .mockImplementation(fetchMock);

  return { adapter, secrets, fetchSpy };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const BOOK_SCHEMA = {
  type: 'object',
  properties: { title: { type: 'string' } },
};

function chatBody(content: string, cost = 0.001) {
  return {
    id: 'gen-1',
    model: 'google/gemini-3.8-flash',
    choices: [{ message: { role: 'assistant', content } }],
    usage: { prompt_tokens: 10, completion_tokens: 20, cost },
  };
}

describe('OpenRouterTextAdapter (SPEC-033)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('posts chat completions with strict json_schema and maps content/usage/cost', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(jsonResponse(chatBody('{"title":"T"}')));
    const { adapter } = buildAdapter(fetchMock);

    const result = await adapter.generate({
      prompt: 'Write a story',
      systemInstruction: 'You write books',
      temperature: 0.8,
      maxOutputTokens: 100,
      responseJsonSchema: BOOK_SCHEMA,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      CHAT_COMPLETIONS_URL,
      expect.objectContaining({ method: 'POST' }),
    );
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const sent = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(sent).toMatchObject({
      model: 'google/gemini-3.8-flash',
      messages: [
        { role: 'system', content: 'You write books' },
        { role: 'user', content: 'Write a story' },
      ],
      temperature: 0.8,
      max_tokens: 100,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'structured_result',
          strict: true,
          schema: BOOK_SCHEMA,
        },
      },
      provider: { require_parameters: true },
    });
    expect(result.text).toBe('{"title":"T"}');
    expect(result.model).toBe('google/gemini-3.8-flash');
    expect(result.usage).toMatchObject({ inputTokens: 10, outputTokens: 20 });
    expect(
      (result.usage as unknown as { costUsd?: number })?.costUsd,
    ).toBeCloseTo(0.001, 6);
  });

  it('resolves the model through ModelSelectionService with the request vertical (SPEC-033B)', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(jsonResponse(chatBody('ok', 0)));
    const configService = new ConfigService({});
    const secrets = {
      get: jest.fn().mockResolvedValue('or-test-key'),
    } as unknown as OpenRouterSecretProvider;
    const resolveText = jest.fn().mockResolvedValue('google/gemini-3.8-flash');
    const modelSelection = {
      resolveText,
    } as unknown as ModelSelectionService;
    const adapter = new OpenRouterTextAdapter(
      new OpenRouterClient(configService, secrets),
      modelSelection,
    );
    jest.spyOn(globalThis, 'fetch').mockImplementation(fetchMock);

    await adapter.generate({
      prompt: 'hi',
      vertical: 'design',
      tenantId: 't1',
    });

    expect(resolveText).toHaveBeenCalledWith('t1', 'design');
  });

  it('sends the pinned default slug when no model is configured', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(jsonResponse(chatBody('ok', 0)));
    const secrets = {
      get: jest.fn().mockResolvedValue('or-test-key'),
    } as unknown as OpenRouterSecretProvider;
    const configService = new ConfigService({});
    const adapter = new OpenRouterTextAdapter(
      new OpenRouterClient(configService, secrets),
      buildModelSelection(configService),
    );
    jest.spyOn(globalThis, 'fetch').mockImplementation(fetchMock);

    const result = await adapter.generate({ prompt: 'hi' });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const sent = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(sent).toMatchObject({ model: 'google/gemini-3.8-flash' });
    expect(result.model).toBe('google/gemini-3.8-flash');
  });

  it('throws CONTENT_BLOCKED when the completion has no content', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse({
        choices: [{ message: { role: 'assistant', content: '' } }],
        usage: { prompt_tokens: 1, completion_tokens: 0, cost: 0 },
      }),
    );
    const { adapter } = buildAdapter(fetchMock);

    await expect(adapter.generate({ prompt: 'hi' })).rejects.toMatchObject({
      code: 'CONTENT_BLOCKED',
    });
  });

  it('maps 429 to RATE_LIMITED without leaking the API key', async () => {
    const apiKey = 'or-live-secret-key';
    const fetchMock = jest
      .fn()
      .mockResolvedValue(new Response('quota exceeded', { status: 429 }));
    const secrets = {
      get: jest.fn().mockResolvedValue(apiKey),
    } as unknown as OpenRouterSecretProvider;
    const configService = new ConfigService({});
    const client = new OpenRouterClient(configService, secrets);
    const adapter = new OpenRouterTextAdapter(
      client,
      buildModelSelection(configService),
    );
    jest.spyOn(globalThis, 'fetch').mockImplementation(fetchMock);

    const error = await adapter.generate({ prompt: 'hi' }).then(
      () => undefined,
      (e: unknown) => e as AiProviderError,
    );

    expect(error?.code).toBe('RATE_LIMITED');
    expect(error?.message).not.toContain(apiKey);
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

  it('throws PROVIDER_UNAVAILABLE when no API key is configured', async () => {
    const secrets = {
      get: jest.fn().mockResolvedValue(null),
    } as unknown as OpenRouterSecretProvider;
    const configService = new ConfigService({});
    const adapter = new OpenRouterTextAdapter(
      new OpenRouterClient(configService, secrets),
      buildModelSelection(configService),
    );

    await expect(adapter.generate({ prompt: 'hi' })).rejects.toMatchObject({
      code: 'PROVIDER_UNAVAILABLE',
    });
  });
});
