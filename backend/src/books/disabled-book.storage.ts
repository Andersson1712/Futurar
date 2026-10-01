import { AiErrorException } from '../common/errors/ai-error.exception';
import type { BookStorage } from './book-storage.port';

export class DisabledBookStorage implements BookStorage {
  upload(): Promise<void> {
    return Promise.reject(disabledError());
  }

  signedUrl(): Promise<string> {
    return Promise.reject(disabledError());
  }
}

function disabledError(): AiErrorException {
  return new AiErrorException(
    503,
    'PROVIDER_UNAVAILABLE',
    'Image storage is not configured',
  );
}
