import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Modality } from '@google/genai';
import { AiProviderError, toProviderError } from '../../ai.errors';
import {
  ImageGenerationRequest,
  ImageGenerationResult,
  ImageGeneratorPort,
} from '../../domain/ports/image-generator.port';
import { GEMINI_CLIENT } from '../../tokens';
import { requireGeminiClient } from './gemini-client.factory';
import type { GeminiClient } from './gemini-client.factory';
import { GEMINI_DEFAULTS, resolveGeminiConfigValue } from './gemini.config';

@Injectable()
export class GeminiImageAdapter implements ImageGeneratorPort {
  constructor(
    @Inject(GEMINI_CLIENT) private readonly client: GeminiClient,
    private readonly configService: ConfigService,
  ) {}

  async generate(
    request: ImageGenerationRequest,
  ): Promise<ImageGenerationResult> {
    const client = requireGeminiClient(this.client);
    const model = resolveGeminiConfigValue(
      this.configService,
      'AI_MODEL_IMAGE',
      GEMINI_DEFAULTS.imageModel,
    );

    try {
      const response = await client.models.generateContent({
        model,
        contents: request.prompt,
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
          imageConfig: {
            aspectRatio: request.aspectRatio,
            imageSize: request.imageSize,
          },
        },
      });

      const parts = response.candidates?.[0]?.content?.parts ?? [];
      const inlineData = parts.find(
        (part) => part.inlineData?.data,
      )?.inlineData;

      if (!inlineData?.data) {
        throw new AiProviderError(
          'CONTENT_BLOCKED',
          'Gemini returned no image content',
        );
      }

      return {
        data: Buffer.from(inlineData.data, 'base64'),
        mimeType: inlineData.mimeType ?? 'image/png',
        model,
      };
    } catch (error) {
      throw toProviderError(error);
    }
  }
}
