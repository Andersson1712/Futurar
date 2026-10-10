import { AiErrorException } from '../common/errors/ai-error.exception';
import type { SupabaseService } from '../supabase/supabase.service';
import type { BookStorage } from './book-storage.port';

interface ErrorResponse {
  error: unknown;
}

interface SignedUrlResponse {
  data: { signedUrl: string } | null;
  error: unknown;
}

interface DownloadResponse {
  data: Blob | null;
  error: unknown;
}

export class SupabaseBookStorage implements BookStorage {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly bucket: string,
  ) {}

  async upload(path: string, data: Buffer, mimeType: string): Promise<void> {
    const response = (await this.client()
      .storage.from(this.bucket)
      .upload(path, data, {
        contentType: mimeType,
        upsert: true,
      })) as unknown as ErrorResponse;

    if (response.error) {
      throw storageUnavailable();
    }
  }

  async signedUrl(path: string, ttlSeconds: number): Promise<string> {
    const response = (await this.client()
      .storage.from(this.bucket)
      .createSignedUrl(path, ttlSeconds)) as unknown as SignedUrlResponse;

    if (response.error || !response.data) {
      throw storageUnavailable();
    }

    return response.data.signedUrl;
  }

  async download(path: string): Promise<Buffer> {
    const response = (await this.client()
      .storage.from(this.bucket)
      .download(path)) as unknown as DownloadResponse;

    if (response.error || !response.data) {
      throw storageUnavailable();
    }

    return Buffer.from(await response.data.arrayBuffer());
  }

  private client() {
    const client = this.supabaseService.getClient();

    if (!client) {
      throw storageUnavailable();
    }

    return client;
  }
}

function storageUnavailable(): AiErrorException {
  return new AiErrorException(
    503,
    'PROVIDER_UNAVAILABLE',
    'Image storage is unavailable',
  );
}
