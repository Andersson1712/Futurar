import { ConfigService } from '@nestjs/config';
import { Modality, type GoogleGenAI } from '@google/genai';
import { AiProviderError } from '../../ai.errors';
import { GeminiTtsAdapter, MAX_TTS_INPUT_CHARS } from './gemini-tts.adapter';
import { GeminiClientProvider } from './gemini-client.provider';

function buildAdapter(
  generateContent: jest.Mock,
  config: Record<string, string> = {},
) {
  const client = {
    models: { generateContent },
  } as unknown as GoogleGenAI;

  const clientProvider = {
    getClient: jest.fn().mockResolvedValue(client),
  } as unknown as GeminiClientProvider;

  return new GeminiTtsAdapter(clientProvider, new ConfigService(config));
}

describe('GeminiTtsAdapter', () => {
  it('requests audio with the default voice and es-419 language', async () => {
    const audio = Buffer.from('fake-audio');
    const generateContent = jest.fn().mockResolvedValue({
      candidates: [
        {
          content: {
            parts: [
              {
                inlineData: {
                  data: audio.toString('base64'),
                  mimeType: 'audio/L16; rate=24000',
                },
              },
            ],
          },
        },
      ],
    });
    const adapter = buildAdapter(generateContent);

    const result = await adapter.synthesize({ text: 'Había una vez' });

    expect(generateContent).toHaveBeenCalledWith({
      model: 'gemini-3.8-flash-tts',
      contents: 'Había una vez',
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          languageCode: 'es-419',
        },
      },
    });
    expect(result.audio.equals(audio)).toBe(true);
    expect(result.mimeType).toBe('audio/L16; rate=24000');
  });

  it('honors per-request voice and language overrides', async () => {
    const generateContent = jest.fn().mockResolvedValue({
      candidates: [
        {
          content: {
            parts: [
              {
                inlineData: {
                  data: Buffer.from('a').toString('base64'),
                  mimeType: 'audio/L16',
                },
              },
            ],
          },
        },
      ],
    });
    const adapter = buildAdapter(generateContent);

    await adapter.synthesize({
      text: 'Hola',
      voiceName: 'Puck',
      languageCode: 'es-ES',
    });

    expect(generateContent).toHaveBeenCalledWith({
      model: 'gemini-3.8-flash-tts',
      contents: 'Hola',
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } },
          languageCode: 'es-ES',
        },
      },
    });
  });

  it('rejects empty input without calling the provider', async () => {
    const generateContent = jest.fn();
    const adapter = buildAdapter(generateContent);

    await expect(adapter.synthesize({ text: '   ' })).rejects.toMatchObject({
      code: 'INVALID_REQUEST',
    });
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('rejects input beyond the supported length', async () => {
    const generateContent = jest.fn();
    const adapter = buildAdapter(generateContent);

    await expect(
      adapter.synthesize({ text: 'a'.repeat(MAX_TTS_INPUT_CHARS + 1) }),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('throws PROVIDER_UNAVAILABLE when no client is configured', async () => {
    const clientProvider = {
      getClient: jest
        .fn()
        .mockRejectedValue(
          new AiProviderError('PROVIDER_UNAVAILABLE', 'missing key'),
        ),
    } as unknown as GeminiClientProvider;
    const adapter = new GeminiTtsAdapter(clientProvider, new ConfigService({}));

    await expect(adapter.synthesize({ text: 'Hola' })).rejects.toMatchObject({
      code: 'PROVIDER_UNAVAILABLE',
    });
  });
});
