import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { AiErrorException } from '../../common/errors/ai-error.exception';

export const CRYPTO_SERVICE = Symbol('CRYPTO_SERVICE');
export const MASTER_KEY_BYTES = 32;
const IV_BYTES = 12;

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  authTag: string;
}

export type CryptoServiceLike = CryptoService | null;

export function parseMasterKey(raw: string | undefined): Buffer | null {
  if (!raw?.trim()) return null;

  try {
    const key = Buffer.from(raw.trim(), 'base64');

    return key.length === MASTER_KEY_BYTES ? key : null;
  } catch {
    return null;
  }
}

export class CryptoService {
  constructor(private readonly key: Buffer) {}

  encrypt(plaintext: string): EncryptedPayload {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    return {
      ciphertext: ciphertext.toString('base64'),
      iv: iv.toString('base64'),
      authTag: cipher.getAuthTag().toString('base64'),
    };
  }

  decrypt(payload: EncryptedPayload): string {
    try {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.key,
        Buffer.from(payload.iv, 'base64'),
      );
      decipher.setAuthTag(Buffer.from(payload.authTag, 'base64'));
      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(payload.ciphertext, 'base64')),
        decipher.final(),
      ]);

      return plaintext.toString('utf8');
    } catch {
      throw new AiErrorException(
        500,
        'INTERNAL',
        'Credential decryption failed',
      );
    }
  }
}
