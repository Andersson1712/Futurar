import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { BookGenerationService } from './application/book-generation.service';
import { BookOutputParser } from './application/book-output.parser';
import { BookOutputValidator } from './application/book-output.validator';
import { BOOK_GENERATION_USE_CASE } from './application/book-generation.use-case';
import { InMemoryJobRegistry } from './application/in-memory-job.registry';
import { PromptBuilderService } from './application/prompt-builder.service';
import { IDEMPOTENCY_STORE } from '../common/idempotency/idempotency-store';
import { InMemoryIdempotencyStore } from '../common/idempotency/in-memory-idempotency.store';
import { SupabaseModule } from '../supabase/supabase.module';
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
  imports: [SupabaseModule],
  controllers: [AiController],
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
    { provide: IDEMPOTENCY_STORE, useClass: InMemoryIdempotencyStore },
    PromptBuilderService,
    BookOutputParser,
    BookOutputValidator,
    InMemoryJobRegistry,
    {
      provide: BOOK_GENERATION_USE_CASE,
      useClass: BookGenerationService,
    },
  ],
  exports: [TEXT_GENERATOR, IMAGE_GENERATOR, TTS_GENERATOR],
})
export class AiModule {}
