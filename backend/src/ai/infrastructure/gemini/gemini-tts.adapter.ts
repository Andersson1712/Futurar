import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Modality } from '@google/genai';
import { AiProviderError, toProviderError } from '../../ai.errors';
import {
  SpeechSynthesisRequest,
  SpeechSynthesisResult,
  TtsPort,
} from '../../domain/ports/tts.port';
import { GeminiClientProvider } from './gemini-client.provider';
import { GEMINI_DEFAULTS, resolveGeminiConfigValue } from './gemini.config';

export const MAX_TTS_INPUT_CHARS = 32_000;

@Injectable()
export class GeminiTtsAdapter implements TtsPort {
  constructor(
    private readonly clientProvider: GeminiClientProvider,
    private readonly configService: ConfigService,
  ) {}

  async synthesize(
    request: SpeechSynthesisRequest,
  ): Promise<SpeechSynthesisResult> {
    const text = request.text.trim();
    if (!text) {
      throw new AiProviderError(
        'INVALID_REQUEST',
        'TTS input must not be empty',
      );
    }
    if (text.length > MAX_TTS_INPUT_CHARS) {
      throw new AiProviderError(
        'INVALID_REQUEST',
        `TTS input exceeds the maximum supported length (${MAX_TTS_INPUT_CHARS} characters)`,
      );
    }

    const client = await this.clientProvider.getClient(request.tenantId);
    const model = resolveGeminiConfigValue(
      this.configService,
      'AI_MODEL_TTS',
      GEMINI_DEFAULTS.ttsModel,
    );
    const voiceName =
      request.voiceName?.trim() ||
      resolveGeminiConfigValue(
        this.configService,
        'AI_TTS_VOICE',
        GEMINI_DEFAULTS.ttsVoice,
      );
    const languageCode =
      request.languageCode?.trim() ||
      resolveGeminiConfigValue(
        this.configService,
        'AI_TTS_LANGUAGE',
        GEMINI_DEFAULTS.ttsLanguage,
      );

    try {
      const response = await client.models.generateContent({
        model,
        contents: text,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
            languageCode,
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
          'Gemini returned no audio content',
        );
      }

      return {
        audio: Buffer.from(inlineData.data, 'base64'),
        mimeType: inlineData.mimeType ?? 'audio/L16; rate=24000',
        model,
      };
    } catch (error) {
      throw toProviderError(error);
    }
  }
}
