import { randomBytes } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { AiCredentialsService } from './ai-credentials.service';
import { InMemoryCredentialRepository } from './secrets/in-memory-credential.repository';
import { CryptoService } from './secrets/crypto.service';
import { AiErrorException } from '../common/errors/ai-error.exception';

const API_KEY = 'AIzaSyTestKey1234567890abcdefg';

function buildService(
  options: { enabled?: boolean; crypto?: CryptoService | null } = {},
) {
  const repository = new InMemoryCredentialRepository();
  const crypto =
    options.crypto === undefined
      ? new CryptoService(randomBytes(32))
      : options.crypto;
  const configService = new ConfigService({
    AI_CREDENTIALS_ENABLED: options.enabled ?? true,
  });
  const service = new AiCredentialsService(repository, crypto, configService);

  return { service, repository };
}

describe('AiCredentialsService (SPEC-020)', () => {
  it('saves a credential and returns metadata only', async () => {
    const { service, repository } = buildService();

    const metadata = await service.save('teacher-1', 'gemini', API_KEY);

    expect(metadata).toMatchObject({
      provider: 'gemini',
      keyHint: 'defg',
      status: 'active',
    });
    expect(JSON.stringify(metadata)).not.toContain(API_KEY);

    const stored = await repository.findActive('teacher-1', 'gemini');
    expect(stored?.encrypted.ciphertext).not.toContain(API_KEY);
  });

  it('rotates keeping a single active credential', async () => {
    const { service } = buildService();

    await service.save('teacher-1', 'gemini', API_KEY);
    await service.save('teacher-1', 'gemini', `${API_KEY}ROTATED`);

    const list = await service.list('teacher-1');
    expect(list.filter((item) => item.status === 'active')).toHaveLength(1);
  });

  it('rejects invalid keys and providers', async () => {
    const { service } = buildService();

    await expect(
      service.save('teacher-1', 'gemini', 'short'),
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
    await expect(
      service.save('teacher-1', 'openai', API_KEY),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('404s when revoking without an active credential', async () => {
    const { service } = buildService();

    await expect(service.revoke('teacher-1', 'gemini')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('is disabled unless the flag and master key are present', async () => {
    const disabled = buildService({ enabled: false });
    const noCrypto = buildService({ crypto: null });

    for (const { service } of [disabled, noCrypto]) {
      const error = await service
        .list('teacher-1')
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(AiErrorException);
      expect((error as AiErrorException).getStatus()).toBe(503);
    }
  });
});
