import { InMemoryCredentialRepository } from './in-memory-credential.repository';
import type { SaveCredentialInput } from './credential.repository';

const ENCRYPTED = { ciphertext: 'c', iv: 'i', authTag: 't' };

function buildInput(overrides: Partial<SaveCredentialInput> = {}): SaveCredentialInput {
  return {
    ownerId: 'teacher-1',
    provider: 'gemini',
    encrypted: ENCRYPTED,
    keyHint: 'AB12',
    ...overrides,
  };
}

describe('InMemoryCredentialRepository (SPEC-020)', () => {
  it('stores metadata and never exposes the plaintext', async () => {
    const repository = new InMemoryCredentialRepository();

    const metadata = await repository.save(buildInput());

    expect(metadata).toMatchObject({ provider: 'gemini', keyHint: 'AB12', status: 'active' });
    expect(JSON.stringify(metadata)).not.toContain('ciphertext');
  });

  it('rotates by storing the new key first and revoking the previous one', async () => {
    const repository = new InMemoryCredentialRepository();
    await repository.save(buildInput({ keyHint: 'OLD1' }));

    await repository.save(buildInput({ keyHint: 'NEW2' }));

    const active = await repository.findActive('teacher-1', 'gemini');
    expect(active?.keyHint).toBe('NEW2');

    const all = await repository.list('teacher-1');
    expect(all).toHaveLength(2);
    expect(all.filter((item) => item.status === 'active')).toHaveLength(1);
    expect(all.find((item) => item.keyHint === 'OLD1')?.status).toBe('revoked');
    expect(all.find((item) => item.keyHint === 'OLD1')?.rotatedAt).toBeDefined();
  });

  it('scopes credentials per owner', async () => {
    const repository = new InMemoryCredentialRepository();
    await repository.save(buildInput({ ownerId: 'teacher-1' }));

    await expect(
      repository.findActive('teacher-2', 'gemini'),
    ).resolves.toBeUndefined();
  });

  it('revokes the active credential', async () => {
    const repository = new InMemoryCredentialRepository();
    await repository.save(buildInput());

    await expect(repository.revoke('teacher-1', 'gemini')).resolves.toBe(true);
    await expect(
      repository.findActive('teacher-1', 'gemini'),
    ).resolves.toBeUndefined();
    await expect(repository.revoke('teacher-1', 'gemini')).resolves.toBe(false);
  });
});
