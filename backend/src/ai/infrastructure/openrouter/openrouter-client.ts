import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiProviderError } from '../../ai.errors';
import { SECRET_PROVIDER } from '../../tokens';
import type { SecretName } from '../../secrets/secret-provider';

export const OPENROUTER_API_BASE_URL = 'https://openrouter.ai/api/v1';
export const OPENROUTER_TEXT_TIMEOUT_MS = 60_000;
export const OPENROUTER_IMAGE_TIMEOUT_MS = 120_000;

interface PostOptions {
  tenantId?: string;
  timeoutMs?: number;
}

/**
 * Minimal key-resolution surface the client needs. It mirrors the shared
 * SecretProvider key union (DB → env fallback at runtime via the
 * SECRET_PROVIDER token) while allowing a nullish return.
 */
export interface OpenRouterSecretProvider {
  get(name: SecretName, tenantId?: string): Promise<string | null | undefined>;
}

/**
 * SPEC-033 — minimal native-fetch wrapper for OpenRouter (no new npm
 * dependency). Owns auth resolution, timeouts and status → AiError
 * mapping. Error messages are static so the API key can never leak.
 */
@Injectable()
export class OpenRouterClient {
  constructor(
    private readonly configService: ConfigService,
    @Inject(SECRET_PROVIDER)
    private readonly secrets: OpenRouterSecretProvider,
  ) {}

  async post<T>(
    path: string,
    body: Record<string, unknown>,
    options: PostOptions = {},
  ): Promise<T> {
    const apiKey = await this.secrets.get(
      'OPENROUTER_API_KEY',
      options.tenantId,
    );

    if (!apiKey) {
      throw new AiProviderError(
        'PROVIDER_UNAVAILABLE',
        'OpenRouter provider is not configured',
      );
    }

    const baseUrl =
      this.configService.get<string>('OPENROUTER_API_BASE_URL')?.trim() ||
      OPENROUTER_API_BASE_URL;
    const timeoutMs = options.timeoutMs ?? Number(OPENROUTER_IMAGE_TIMEOUT_MS);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await globalThis.fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw statusToError(response.status);
      }

      return (await parseJson(response)) as T;
    } catch (error) {
      throw toClientError(error);
    } finally {
      clearTimeout(timer);
    }
  }
}

const STATUS_TO_CODE: Record<number, AiProviderError['code']> = {
  400: 'INVALID_REQUEST',
  401: 'PROVIDER_UNAVAILABLE',
  402: 'PROVIDER_UNAVAILABLE',
  403: 'CONTENT_BLOCKED',
  404: 'INVALID_REQUEST',
  408: 'TIMEOUT',
  429: 'RATE_LIMITED',
  500: 'PROVIDER_UNAVAILABLE',
  502: 'PROVIDER_UNAVAILABLE',
  503: 'PROVIDER_UNAVAILABLE',
};

function statusToError(status: number): AiProviderError {
  return new AiProviderError(
    STATUS_TO_CODE[status] ?? 'UNKNOWN',
    `OpenRouter request failed (status ${status})`,
  );
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new AiProviderError(
      'INVALID_OUTPUT',
      'OpenRouter returned a non-JSON response',
    );
  }
}

function toClientError(error: unknown): AiProviderError {
  if (error instanceof AiProviderError) return error;

  if (error instanceof DOMException && error.name === 'AbortError') {
    return new AiProviderError('TIMEOUT', 'OpenRouter request timed out');
  }

  if (error instanceof Error && error.name === 'AbortError') {
    return new AiProviderError('TIMEOUT', 'OpenRouter request timed out');
  }

  if (error instanceof TypeError) {
    return new AiProviderError(
      'PROVIDER_UNAVAILABLE',
      'OpenRouter provider is unreachable',
    );
  }

  return new AiProviderError('UNKNOWN', 'The OpenRouter request failed', error);
}
