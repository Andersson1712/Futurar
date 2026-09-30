import { Module } from '@nestjs/common';
import { EnvSecretProvider } from './secrets/env-secret.provider';
import { SecretProvider } from './secrets/secret-provider';
import { createGeminiClient } from './infrastructure/gemini/gemini-client.factory';
import { GeminiImageAdapter } from './infrastructure/gemini/gemini-image.adapter';
import { GeminiTextAdapter } from './infrastructure/gemini/gemini-text.adapter';
import { GeminiTtsAdapter } from './infrastructure/gemini/gemini-tts.adapter';
import {
  GEMINI_CLIENT,
  IMAGE_GENERATOR,
  SECRET_PROVIDER,
  TEXT_GENERATOR,
  TTS_GENERATOR,
} from './tokens';

@Module({
  providers: [
    { provide: SECRET_PROVIDER, useClass: EnvSecretProvider },
    {
      provide: GEMINI_CLIENT,
      useFactory: (secrets: SecretProvider) => createGeminiClient(secrets),
      inject: [SECRET_PROVIDER],
    },
    { provide: TEXT_GENERATOR, useClass: GeminiTextAdapter },
    { provide: IMAGE_GENERATOR, useClass: GeminiImageAdapter },
    { provide: TTS_GENERATOR, useClass: GeminiTtsAdapter },
  ],
  exports: [TEXT_GENERATOR, IMAGE_GENERATOR, TTS_GENERATOR],
})
export class AiModule {}
