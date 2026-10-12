import { ConfigService } from '@nestjs/config';
import { Modality, type GoogleGenAI } from '@google/genai';
import { GeminiImageAdapter } from './gemini-image.adapter';
import { AiProviderError } from '../../ai.errors';
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

  return new GeminiImageAdapter(clientProvider, new ConfigService(config));
}

describe('GeminiImageAdapter', () => {
  it('maps inline image data, mime type and default model', async () => {
    const bytes = Buffer.from('fake-image');
    const generateContent = jest.fn().mockResolvedValue({
      candidates: [
        {
          content: {
            parts: [
              { text: 'Here is your image' },
              {
                inlineData: {
                  data: bytes.toString('base64'),
                  mimeType: 'image/png',
                },
              },
            ],
          },
        },
      ],
    });
    const adapter = buildAdapter(generateContent);

    const result = await adapter.generate({ prompt: 'A castle' });

    expect(result.data.equals(bytes)).toBe(true);
    expect(result.mimeType).toBe('image/png');
    expect(result.model).toBe('gemini-3.1-flash-image');
  });

  it('passes aspect ratio and image size to the SDK', async () => {
    const generateContent = jest.fn().mockResolvedValue({
      candidates: [
        {
          content: {
            parts: [
              {
                inlineData: {
                  data: Buffer.from('img').toString('base64'),
                  mimeType: 'image/jpeg',
                },
              },
            ],
          },
        },
      ],
    });
    const adapter = buildAdapter(generateContent);

    await adapter.generate({
      prompt: 'A castle',
      aspectRatio: '3:4',
      imageSize: '2K',
    });

    expect(generateContent).toHaveBeenCalledWith({
      model: 'gemini-3.1-flash-image',
      contents: 'A castle',
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
        imageConfig: { aspectRatio: '3:4', imageSize: '2K' },
      },
    });
  });

  it('throws CONTENT_BLOCKED when no image part is returned', async () => {
    const generateContent = jest.fn().mockResolvedValue({
      candidates: [{ content: { parts: [{ text: 'No image' }] } }],
    });
    const adapter = buildAdapter(generateContent);

    await expect(adapter.generate({ prompt: 'hi' })).rejects.toMatchObject({
      code: 'CONTENT_BLOCKED',
    });
  });

  it('throws PROVIDER_UNAVAILABLE when no client is configured', async () => {
    const clientProvider = {
      getClient: jest
        .fn()
        .mockRejectedValue(
          new AiProviderError('PROVIDER_UNAVAILABLE', 'missing key'),
        ),
    } as unknown as GeminiClientProvider;
    const adapter = new GeminiImageAdapter(
      clientProvider,
      new ConfigService({}),
    );

    await expect(adapter.generate({ prompt: 'hi' })).rejects.toMatchObject({
      code: 'PROVIDER_UNAVAILABLE',
    });
  });
});
