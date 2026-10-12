import { GeminiClientProvider } from './gemini-client.provider';
import { AiProviderError } from '../../ai.errors';

function buildProvider(get: jest.Mock): GeminiClientProvider {
  return new GeminiClientProvider({ get });
}

describe('GeminiClientProvider (SPEC-020)', () => {
  it('throws PROVIDER_UNAVAILABLE when no key is configured', async () => {
    const provider = buildProvider(jest.fn().mockResolvedValue(undefined));

    await expect(provider.getClient()).rejects.toBeInstanceOf(AiProviderError);
  });

  it('resolves the key per tenant and caches by key hash', async () => {
    const get = jest.fn().mockResolvedValue('key-1');
    const provider = buildProvider(get);

    const first = await provider.getClient('teacher-1');
    const second = await provider.getClient('teacher-2');

    expect(get).toHaveBeenCalledWith('GEMINI_API_KEY', 'teacher-1');
    expect(get).toHaveBeenCalledWith('GEMINI_API_KEY', 'teacher-2');
    expect(first).toBe(second);
  });

  it('builds a new client after rotation', async () => {
    const get = jest
      .fn()
      .mockResolvedValueOnce('key-1')
      .mockResolvedValueOnce('key-2');
    const provider = buildProvider(get);

    const first = await provider.getClient('teacher-1');
    const second = await provider.getClient('teacher-1');

    expect(first).not.toBe(second);
  });
});
