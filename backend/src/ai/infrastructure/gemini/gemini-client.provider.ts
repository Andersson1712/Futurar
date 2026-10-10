import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { GoogleGenAI } from '@google/genai';
import { AiProviderError } from '../../ai.errors';
import { SECRET_PROVIDER } from '../../tokens';
import type { SecretProvider } from '../../secrets/secret-provider';

/**
 * Resolves a Gemini client per tenant, caching instances by key hash so
 * rotated credentials are picked up without restarts.
 */
@Injectable()
export class GeminiClientProvider {
  private readonly cache = new Map<string, GoogleGenAI>();

  constructor(
    @Inject(SECRET_PROVIDER) private readonly secrets: SecretProvider,
  ) {}

  async getClient(tenantId?: string): Promise<GoogleGenAI> {
    const apiKey = await this.secrets.get('GEMINI_API_KEY', tenantId);

    if (!apiKey) {
      throw new AiProviderError(
        'PROVIDER_UNAVAILABLE',
        'Gemini provider is not configured',
      );
    }

    const hash = createHash('sha256').update(apiKey).digest('hex');
    const cached = this.cache.get(hash);

    if (cached) return cached;

    const client = new GoogleGenAI({ apiKey });
    this.cache.set(hash, client);

    return client;
  }
}
