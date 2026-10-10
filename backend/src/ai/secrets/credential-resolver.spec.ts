import { randomBytes } from 'node:crypto';
import { CredentialResolver } from './credential-resolver';
import type {
  CredentialProvider,
  CredentialRepository,
  StoredCredential,
} from './credential.repository';
import { CryptoService } from './crypto.service';

function buildResolver(options: { crypto?: CryptoService | null } = {}) {
  const crypto =
    options.crypto === undefined
      ? new CryptoService(randomBytes(32))
      : options.crypto;
  const findActive = jest.fn();
  const repository = {
    save: jest.fn(),
    findActive,
    list: jest.fn(),
    revoke: jest.fn(),
  } as unknown as CredentialRepository;
  const resolver = new CredentialResolver(repository, crypto);

  return { resolver, findActive, crypto };
}

function stored(
  provider: CredentialProvider,
  encrypted: StoredCredential['encrypted'],
): StoredCredential {
  const now = new Date();

  return {
    id: 'cred-1',
    ownerId: 'teacher-1',
    provider,
    keyHint: 'key1',
    status: 'active',
    createdAt: now,
    updatedAt: now,
    encrypted,
  };
}

describe('CredentialResolver (SPEC-033D)', () => {
  it('forwards the provider and returns the decrypted tenant key', async () => {
    const { resolver, findActive, crypto } = buildResolver();
    findActive.mockResolvedValue(
      stored('openrouter', crypto!.encrypt('tenant-openrouter-key')),
    );

    await expect(
      resolver.findActiveKey('teacher-1', 'openrouter'),
    ).resolves.toBe('tenant-openrouter-key');
    expect(findActive).toHaveBeenCalledWith('teacher-1', 'openrouter');
  });

  it('forwards the gemini provider unchanged', async () => {
    const { resolver, findActive, crypto } = buildResolver();
    findActive.mockResolvedValue(stored('gemini', crypto!.encrypt('g-key')));

    await expect(resolver.findActiveKey('teacher-1', 'gemini')).resolves.toBe(
      'g-key',
    );
    expect(findActive).toHaveBeenCalledWith('teacher-1', 'gemini');
  });

  it('returns undefined for a missing row without reading env', async () => {
    const { resolver, findActive } = buildResolver();
    findActive.mockResolvedValue(undefined);

    await expect(
      resolver.findActiveKey('teacher-1', 'openrouter'),
    ).resolves.toBeUndefined();
  });

  it('skips the repository when credentials are disabled (no crypto)', async () => {
    const { resolver, findActive } = buildResolver({ crypto: null });

    await expect(
      resolver.findActiveKey('teacher-1', 'openrouter'),
    ).resolves.toBeUndefined();
    expect(findActive).not.toHaveBeenCalled();
  });

  it('propagates a decryption failure loudly', async () => {
    const { resolver, findActive } = buildResolver();
    findActive.mockResolvedValue(
      stored('openrouter', {
        ciphertext: 'bm90LXJlYWw=',
        iv: 'AAAAAAAAAAAAAAAA',
        authTag: 'AAAAAAAAAAAAAAAAAAAAAA==',
      }),
    );

    await expect(
      resolver.findActiveKey('teacher-1', 'openrouter'),
    ).rejects.toMatchObject({ code: 'INTERNAL' });
  });
});
