import { randomBytes } from 'node:crypto';
import { CryptoService, parseMasterKey } from './crypto.service';
import { AiErrorException } from '../../common/errors/ai-error.exception';

const KEY = randomBytes(32);

describe('CryptoService (SPEC-020)', () => {
  it('round-trips plaintext', () => {
    const crypto = new CryptoService(KEY);
    const payload = crypto.encrypt('AIza-test-key-1234567890');

    expect(payload.ciphertext).not.toContain('AIza');
    expect(crypto.decrypt(payload)).toBe('AIza-test-key-1234567890');
  });

  it('uses a random IV per encryption', () => {
    const crypto = new CryptoService(KEY);
    const first = crypto.encrypt('same');
    const second = crypto.encrypt('same');

    expect(first.iv).not.toBe(second.iv);
    expect(first.ciphertext).not.toBe(second.ciphertext);
  });

  it('fails closed on tampered payloads', () => {
    const crypto = new CryptoService(KEY);
    const payload = crypto.encrypt('secret');

    expect(() =>
      crypto.decrypt({
        ...payload,
        authTag: Buffer.from('nope').toString('base64'),
      }),
    ).toThrow(AiErrorException);

    expect(() =>
      crypto.decrypt({
        ...payload,
        ciphertext: Buffer.from('nope').toString('base64'),
      }),
    ).toThrow(AiErrorException);
  });

  it('rejects decryption with a different key', () => {
    const payload = new CryptoService(KEY).encrypt('secret');

    expect(() => new CryptoService(randomBytes(32)).decrypt(payload)).toThrow(
      AiErrorException,
    );
  });

  it('parses only base64 32-byte master keys', () => {
    expect(parseMasterKey(undefined)).toBeNull();
    expect(parseMasterKey('')).toBeNull();
    expect(parseMasterKey('not-base64')).toBeNull();
    expect(parseMasterKey(randomBytes(16).toString('base64'))).toBeNull();
    expect(parseMasterKey(randomBytes(32).toString('base64'))).not.toBeNull();
  });
});
