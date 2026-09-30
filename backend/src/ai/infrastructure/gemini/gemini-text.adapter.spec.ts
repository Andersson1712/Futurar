import { ConfigService } from '@nestjs/config';
import type { GoogleGenAI } from '@google/genai';
import { AiProviderError } from '../../ai.errors';
import { GeminiTextAdapter } from './gemini-text.adapter';

function buildAdapter(
  generateContent: jest.Mock,
  config: Record<string, string> = {},
) {
  const client = {
    models: { generateContent },
  } as unknown as GoogleGenAI;

  return new GeminiTextAdapter(client, new ConfigService(config));
}

describe('GeminiTextAdapter', () => {
  it('maps the SDK response, default model and token usage', async () => {
    const generateContent = jest.fn().mockResolvedValue({
      text: 'Había una vez',
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20 },
    });
    const adapter = buildAdapter(generateContent);

    const result = await adapter.generate({ prompt: 'Write a story' });

    expect(generateContent).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gemini-3.8-flash' }),
    );
    expect(result).toEqual({
      text: 'Había una vez',
      model: 'gemini-3.8-flash',
      usage: { inputTokens: 10, outputTokens: 20 },
    });
  });

  it('uses the configured model', async () => {
    const generateContent = jest.fn().mockResolvedValue({ text: 'ok' });
    const adapter = buildAdapter(generateContent, {
      AI_MODEL_TEXT: 'gemini-test-model',
    });

    const result = await adapter.generate({ prompt: 'hi' });

    expect(result.model).toBe('gemini-test-model');
  });

  it('throws CONTENT_BLOCKED when the response has no text', async () => {
    const adapter = buildAdapter(jest.fn().mockResolvedValue({}));

    await expect(adapter.generate({ prompt: 'hi' })).rejects.toMatchObject({
      code: 'CONTENT_BLOCKED',
    });
  });

  it('throws PROVIDER_UNAVAILABLE when no client is configured', async () => {
    const adapter = new GeminiTextAdapter(null, new ConfigService({}));

    await expect(adapter.generate({ prompt: 'hi' })).rejects.toBeInstanceOf(
      AiProviderError,
    );
  });

  it('maps provider errors without leaking the API key', async () => {
    const apiKey = 'test-secret-key';
    const generateContent = jest.fn().mockRejectedValue({
      status: 429,
      message: `quota exceeded for ${apiKey}`,
    });
    const adapter = buildAdapter(generateContent);

    const error = await adapter.generate({ prompt: 'hi' }).then(
      () => undefined,
      (e: unknown) => e as AiProviderError,
    );

    expect(error?.code).toBe('RATE_LIMITED');
    expect(error?.message).not.toContain(apiKey);
  });
});
