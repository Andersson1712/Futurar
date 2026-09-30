import { GoogleGenAI } from '@google/genai';
import { AiProviderError } from '../../ai.errors';
import { SecretProvider } from '../../secrets/secret-provider';

export type GeminiClient = GoogleGenAI | null;

export function createGeminiClient(secrets: SecretProvider): GeminiClient {
  const apiKey = secrets.get('GEMINI_API_KEY');
  if (!apiKey) return null;

  return new GoogleGenAI({ apiKey });
}

export function requireGeminiClient(client: GeminiClient): GoogleGenAI {
  if (!client) {
    throw new AiProviderError(
      'PROVIDER_UNAVAILABLE',
      'Gemini provider is not configured (missing GEMINI_API_KEY)',
    );
  }

  return client;
}
