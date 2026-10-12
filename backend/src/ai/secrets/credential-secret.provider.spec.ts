import { CredentialSecretProvider } from './credential-secret.provider';
import type { CredentialProvider } from './credential.repository';
import type { SecretProvider } from './secret-provider';

function buildProvider(options: {
  stored?: Partial<Record<CredentialProvider, string>>;
  storedError?: Error;
  env?: string;
}) {
  const findActiveKey = options.storedError
    ? jest.fn().mockRejectedValue(options.storedError)
    : jest.fn((_tenantId: string, provider: CredentialProvider) =>
        Promise.resolve(options.stored?.[provider]),
      );
  const fallbackGet = jest.fn().mockResolvedValue(options.env);
  const fallback: SecretProvider = { get: fallbackGet };

  return {
    provider: new CredentialSecretProvider({ findActiveKey }, fallback),
    findActiveKey,
    fallbackGet,
  };
}

describe('CredentialSecretProvider (SPEC-020, SPEC-033D)', () => {
  it('prefers the tenant credential and passes its provider', async () => {
    const { provider, findActiveKey, fallbackGet } = buildProvider({
      stored: { gemini: 'stored-key' },
      env: 'env-key',
    });

    await expect(provider.get('GEMINI_API_KEY', 'teacher-1')).resolves.toBe(
      'stored-key',
    );
    expect(findActiveKey).toHaveBeenCalledWith('teacher-1', 'gemini');
    expect(fallbackGet).not.toHaveBeenCalled();
  });

  it('resolves the OpenRouter tenant key with its own provider', async () => {
    const { provider, findActiveKey, fallbackGet } = buildProvider({
      stored: { openrouter: 'or-key' },
      env: 'env-key',
    });

    await expect(provider.get('OPENROUTER_API_KEY', 'teacher-1')).resolves.toBe(
      'or-key',
    );
    expect(findActiveKey).toHaveBeenCalledWith('teacher-1', 'openrouter');
    expect(fallbackGet).not.toHaveBeenCalled();
  });

  it('resolves each provider independently when both are stored', async () => {
    const { provider } = buildProvider({
      stored: { gemini: 'gemini-key', openrouter: 'openrouter-key' },
      env: 'env-key',
    });

    await expect(provider.get('GEMINI_API_KEY', 'teacher-1')).resolves.toBe(
      'gemini-key',
    );
    await expect(provider.get('OPENROUTER_API_KEY', 'teacher-1')).resolves.toBe(
      'openrouter-key',
    );
  });

  it('falls back to the env provider without a tenant or stored key', async () => {
    const { provider } = buildProvider({ env: 'env-key' });

    await expect(provider.get('GEMINI_API_KEY')).resolves.toBe('env-key');
    await expect(provider.get('GEMINI_API_KEY', 'teacher-1')).resolves.toBe(
      'env-key',
    );
  });

  it('falls back to env when the tenant has no stored key', async () => {
    const { provider, findActiveKey } = buildProvider({ env: 'env-key' });

    await expect(provider.get('OPENROUTER_API_KEY', 'teacher-1')).resolves.toBe(
      'env-key',
    );
    expect(findActiveKey).toHaveBeenCalledWith('teacher-1', 'openrouter');
  });

  it('fails loudly when a stored credential cannot be resolved', async () => {
    const { provider, fallbackGet } = buildProvider({
      storedError: new Error('decrypt failed'),
      env: 'env-key',
    });

    await expect(provider.get('GEMINI_API_KEY', 'teacher-1')).rejects.toThrow(
      'decrypt failed',
    );
    expect(fallbackGet).not.toHaveBeenCalled();
  });

  it('returns undefined when nothing is configured', async () => {
    const { provider } = buildProvider({});

    await expect(
      provider.get('GEMINI_API_KEY', 'teacher-1'),
    ).resolves.toBeUndefined();
  });
});
