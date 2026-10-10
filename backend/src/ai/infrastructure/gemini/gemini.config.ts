import { ConfigService } from '@nestjs/config';

export const GEMINI_DEFAULTS = {
  textModel: 'gemini-3.8-flash',
  imageModel: 'gemini-3.1-flash-image',
  ttsModel: 'gemini-3.8-flash-tts',
  ttsVoice: 'Kore',
  ttsLanguage: 'es-419',
} as const;

export function resolveGeminiConfigValue(
  configService: ConfigService,
  key: string,
  fallback: string,
): string {
  return configService.get<string>(key)?.trim() || fallback;
}
