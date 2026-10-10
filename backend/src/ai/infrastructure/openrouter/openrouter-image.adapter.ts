import { Injectable, Optional } from '@nestjs/common';
import { AiProviderError, toProviderError } from '../../ai.errors';
import { ModelSelectionService } from '../../application/model-selection.service';
import type {
  ImageGenerationRequest,
  ImageGenerationResult,
  ImageGenerationUsage,
  ImageGeneratorPort,
} from '../../domain/ports/image-generator.port';
import {
  OPENROUTER_IMAGE_TIMEOUT_MS,
  OpenRouterClient,
} from './openrouter-client';

interface OpenRouterImageResponse {
  data?: Array<{ b64_json?: string }>;
  usage?: { cost?: number };
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
    private readonly modelSelection: ModelSelectionService,
    @Optional() private readonly timeoutMs?: number,
  ) {}

  async generate(
    request: ImageGenerationRequest,
  ): Promise<ImageGenerationResult> {
    // SPEC-033B: resolve per teacher (owner = request tenantId) and per
    // vertical instead of hardcoding `.book`; defaults to 'book' when absent.
    const model = await this.modelSelection.resolveImage(
      request.tenantId,
      request.vertical ?? 'book',
    );

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
        usage: mapUsage(response.usage),
      };
    } catch (error) {
      throw toProviderError(error);
    }
  }
}

function mapUsage(
  usage: OpenRouterImageResponse['usage'],
): ImageGenerationUsage | undefined {
  if (!usage) return undefined;

  return { costUsd: usage.cost };
}
