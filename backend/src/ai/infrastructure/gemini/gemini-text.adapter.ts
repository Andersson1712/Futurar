import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { GenerateContentResponseUsageMetadata } from '@google/genai';
import { AiProviderError, toProviderError } from '../../ai.errors';
import {
  TextGenerationRequest,
  TextGenerationResult,
  TextGenerationUsage,
  TextGeneratorPort,
} from '../../domain/ports/text-generator.port';
import { GeminiClientProvider } from './gemini-client.provider';
import { GEMINI_DEFAULTS, resolveGeminiConfigValue } from './gemini.config';

function mapUsage(
  usage?: GenerateContentResponseUsageMetadata,
): TextGenerationUsage | undefined {
  if (!usage) return undefined;

  return {
    inputTokens: usage.promptTokenCount,
    outputTokens: usage.candidatesTokenCount,
  };
}

@Injectable()
export class GeminiTextAdapter implements TextGeneratorPort {
  constructor(
    private readonly clientProvider: GeminiClientProvider,
    private readonly configService: ConfigService,
  ) {}

  async generate(
    request: TextGenerationRequest,
  ): Promise<TextGenerationResult> {
    const client = await this.clientProvider.getClient(request.tenantId);
    const model = resolveGeminiConfigValue(
      this.configService,
      'AI_MODEL_TEXT',
      GEMINI_DEFAULTS.textModel,
    );

    try {
      const response = await client.models.generateContent({
        model,
        contents: request.prompt,
        config: {
          systemInstruction: request.systemInstruction,
          temperature: request.temperature,
          maxOutputTokens: request.maxOutputTokens,
          responseMimeType: request.responseJsonSchema
            ? 'application/json'
            : undefined,
          responseJsonSchema: request.responseJsonSchema,
        },
      });

      const text = response.text;
      if (!text) {
        throw new AiProviderError(
          'CONTENT_BLOCKED',
          'Gemini returned an empty text response',
        );
      }

      return { text, model, usage: mapUsage(response.usageMetadata) };
    } catch (error) {
      throw toProviderError(error);
    }
  }
}
