import { CredentialSecretProvider } from './credential-secret.provider';
import type { SecretProvider } from './secret-provider';

function buildProvider(options: {
  stored?: string;
  storedError?: Error;
  env?: string;
}) {
  const findActiveKey = options.storedError
    ? jest.fn().mockRejectedValue(options.storedError)
    : jest.fn().mockResolvedValue(options.stored);
  const fallbackGet = jest.fn().mockResolvedValue(options.env);
  const fallback: SecretProvider = { get: fallbackGet };

  return {
    provider: new CredentialSecretProvider({ findActiveKey }, fallback),
    findActiveKey,
    fallbackGet,
  };
}

describe('CredentialSecretProvider (SPEC-020)', () => {
  it('prefers the tenant credential', async () => {
    const { provider, findActiveKey, fallbackGet } = buildProvider({
      stored: 'stored-key',
      env: 'env-key',
    });

    await expect(provider.get('GEMINI_API_KEY', 'teacher-1')).resolves.toBe(
      'stored-key',
    );
    expect(findActiveKey).toHaveBeenCalledWith('teacher-1');
    expect(fallbackGet).not.toHaveBeenCalled();
  });

  it('falls back to the env provider without a tenant or stored key', async () => {
    const { provider } = buildProvider({ env: 'env-key' });

    await expect(provider.get('GEMINI_API_KEY')).resolves.toBe('env-key');
    await expect(provider.get('GEMINI_API_KEY', 'teacher-1')).resolves.toBe(
      'env-key',
    );
  });

  it('falls back to env when credential resolution fails', async () => {
    const { provider } = buildProvider({
      storedError: new Error('decrypt failed'),
      env: 'env-key',
    });

    await expect(provider.get('GEMINI_API_KEY', 'teacher-1')).resolves.toBe(
      'env-key',
    );
  });

  it('returns undefined when nothing is configured', async () => {
    const { provider } = buildProvider({});

    await expect(
      provider.get('GEMINI_API_KEY', 'teacher-1'),
    ).resolves.toBeUndefined();
  });
});
