import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiController } from './ai.controller';
import { BookGenerationService } from './application/book-generation.service';
import { BookOutputParser } from './application/book-output.parser';
import { BookOutputValidator } from './application/book-output.validator';
import { BOOK_GENERATION_USE_CASE } from './application/book-generation.use-case';
import { BookPersistenceService } from './application/book-persistence.service';
import { CircuitBreaker } from './application/circuit-breaker';
import { GenerationRunner } from './application/generation-runner';
import { JobStatusStream } from './application/job-status.stream';
import { PromptBuilderService } from './application/prompt-builder.service';
import { BooksModule } from '../books/books.module';
import { IDEMPOTENCY_STORE } from '../common/idempotency/idempotency-store';
import { InMemoryIdempotencyStore } from '../common/idempotency/in-memory-idempotency.store';
import { RedisIdempotencyStore } from '../common/idempotency/redis-idempotency.store';
import { REDIS_CLIENT } from '../common/redis/redis-client';
import type { RedisClient } from '../common/redis/redis-client';
import { RedisModule } from '../common/redis/redis.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { SupabaseService } from '../supabase/supabase.service';
import { BullMqJobQueue } from '../jobs/bullmq-job.queue';
import { InlineJobQueue } from '../jobs/inline-job.queue';
import { InMemoryJobRepository } from '../jobs/in-memory-job.repository';
import { JOB_QUEUE } from '../jobs/job-queue.port';
import type { JobQueue } from '../jobs/job-queue.port';
import { JOB_REPOSITORY } from '../jobs/job.repository';
import type { JobRepository } from '../jobs/job.repository';
import { resolveQueueDriver } from '../jobs/queue-driver';
import { SupabaseJobRepository } from '../jobs/supabase-job.repository';
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
  imports: [SupabaseModule, RedisModule, BooksModule],
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
    InMemoryIdempotencyStore,
    {
      provide: IDEMPOTENCY_STORE,
      useFactory: (redis: RedisClient, memory: InMemoryIdempotencyStore) =>
        redis ? new RedisIdempotencyStore(redis) : memory,
      inject: [REDIS_CLIENT, InMemoryIdempotencyStore],
    },
    PromptBuilderService,
    BookOutputParser,
    BookOutputValidator,
    BookPersistenceService,
    CircuitBreaker,
    InMemoryJobRepository,
    {
      provide: JOB_REPOSITORY,
      useFactory: (
        supabaseService: SupabaseService,
        memory: InMemoryJobRepository,
      ): JobRepository =>
        supabaseService.getClient()
          ? new SupabaseJobRepository(supabaseService)
          : memory,
      inject: [SupabaseService, InMemoryJobRepository],
    },
    GenerationRunner,
    {
      provide: JOB_QUEUE,
      useFactory: (
        configService: ConfigService,
        redis: RedisClient,
        runner: GenerationRunner,
        jobs: JobRepository,
      ): JobQueue => {
        if (resolveQueueDriver(configService) === 'bullmq') {
          if (!redis) {
            throw new Error('REDIS_URL is required for QUEUE_DRIVER=bullmq');
          }

          return new BullMqJobQueue(redis, runner, jobs);
        }

        return new InlineJobQueue(runner, jobs);
      },
      inject: [ConfigService, REDIS_CLIENT, GenerationRunner, JOB_REPOSITORY],
    },
    JobStatusStream,
    {
      provide: BOOK_GENERATION_USE_CASE,
      useClass: BookGenerationService,
    },
  ],
  exports: [TEXT_GENERATOR, IMAGE_GENERATOR, TTS_GENERATOR],
})
export class AiModule {}
