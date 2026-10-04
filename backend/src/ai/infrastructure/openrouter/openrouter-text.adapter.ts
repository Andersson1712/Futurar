import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiProviderError, toProviderError } from '../../ai.errors';
import type {
  TextGenerationRequest,
  TextGenerationResult,
  TextGenerationUsage,
  TextGeneratorPort,
} from '../../domain/ports/text-generator.port';
import {
  OPENROUTER_TEXT_TIMEOUT_MS,
  OpenRouterClient,
} from './openrouter-client';
import { resolveOpenRouterConfig } from './openrouter.config';

interface OpenRouterChatResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
  model?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    cost?: number;
  };
}

/**
 * SPEC-033 — OpenRouter text adapter behind the TEXT_GENERATOR port.
 * Chat completions with `response_format: json_schema` (strict) plus
 * `provider.require_parameters`, reusing the per-vertical schemas, so
 * routing only hits endpoints honoring the schema. Output shape matches
 * the Gemini adapter exactly (`{ text, model, usage }`); the
 * per-response `usage.cost` (USD) rides along on `usage` for the
 * persistence/metrics paths.
 */
@Injectable()
export class OpenRouterTextAdapter implements TextGeneratorPort {
  constructor(
    private readonly client: OpenRouterClient,
    private readonly configService: ConfigService,
  ) {}

  async generate(
    request: TextGenerationRequest,
  ): Promise<TextGenerationResult> {
    // Single shared instance serves the book vertical; per-teacher model
    // selection is SPEC-033B (out of scope here).
    const model = resolveOpenRouterConfig(this.configService).book.textModel;

    try {
      const response = await this.client.post<OpenRouterChatResponse>(
        '/chat/completions',
        {
          model,
          messages: buildMessages(request),
          temperature: request.temperature,
          max_tokens: request.maxOutputTokens,
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'structured_result',
              strict: true,
              schema: request.responseJsonSchema,
            },
          },
          provider: { require_parameters: true },
        },
        {
          tenantId: request.tenantId,
          timeoutMs: OPENROUTER_TEXT_TIMEOUT_MS,
        },
      );

      const text = response.choices?.[0]?.message?.content;

      if (!text) {
        throw new AiProviderError(
          'CONTENT_BLOCKED',
          'OpenRouter returned an empty text response',
        );
      }

      return { text, model, usage: mapUsage(response.usage) };
    } catch (error) {
      throw toProviderError(error);
    }
  }
}

function buildMessages(
  request: TextGenerationRequest,
): Array<{ role: string; content: string }> {
  const messages: Array<{ role: string; content: string }> = [];

  if (request.systemInstruction) {
    messages.push({ role: 'system', content: request.systemInstruction });
  }

  messages.push({ role: 'user', content: request.prompt });

  return messages;
}

function mapUsage(
  usage: OpenRouterChatResponse['usage'],
): TextGenerationUsage | undefined {
  if (!usage) return undefined;

  // costUsd has no slot in TextGenerationUsage yet (port owned by 033-1
  // scope); carried at runtime for the cost-recording paths. See 033-4 gap.
  return {
    inputTokens: usage.prompt_tokens,
    outputTokens: usage.completion_tokens,
    costUsd: usage.cost,
  };
}
