import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiProviderError, toProviderError } from '../../ai.errors';
import type {
  ImageGenerationRequest,
  ImageGenerationResult,
  ImageGeneratorPort,
} from '../../domain/ports/image-generator.port';
import {
  OPENROUTER_IMAGE_TIMEOUT_MS,
  OpenRouterClient,
} from './openrouter-client';
import { resolveOpenRouterConfig } from './openrouter.config';

interface OpenRouterImageResponse {
  data?: Array<{ b64_json?: string }>;
}

/**
 * SPEC-033 — OpenRouter image adapter behind the IMAGE_GENERATOR port.
 * Posts the dedicated Image API with a normalized subset only
 * (`aspect_ratio`, `size`); `n > 1`, streaming and `input_references`
 * are not used in this SPEC. Maps `data[0].b64_json` → bytes.
 */
@Injectable()
export class OpenRouterImageAdapter implements ImageGeneratorPort {
  constructor(
    private readonly client: OpenRouterClient,
    private readonly configService: ConfigService,
    @Optional() private readonly timeoutMs?: number,
  ) {}

  async generate(
    request: ImageGenerationRequest,
  ): Promise<ImageGenerationResult> {
    // Single shared instance serves the book vertical; per-teacher model
    // selection is SPEC-033B (out of scope here).
    const model = resolveOpenRouterConfig(this.configService).book.imageModel;

    try {
      const response = await this.client.post<OpenRouterImageResponse>(
        '/images',
        {
          model,
          prompt: request.prompt,
          aspect_ratio: request.aspectRatio,
          size: request.imageSize,
        },
        {
          tenantId: request.tenantId,
          timeoutMs: this.timeoutMs ?? OPENROUTER_IMAGE_TIMEOUT_MS,
        },
      );

      const b64 = response.data?.[0]?.b64_json;

      if (!b64) {
        throw new AiProviderError(
          'CONTENT_BLOCKED',
          'OpenRouter returned no image content',
        );
      }

      return {
        data: Buffer.from(b64, 'base64'),
        mimeType: 'image/png',
        model,
      };
    } catch (error) {
      throw toProviderError(error);
    }
  }
}
