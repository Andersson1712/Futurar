import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { AiController } from './ai.controller';
import { ExportsController } from '../exports/exports.controller';
import { BookGenerationService } from './application/book-generation.service';
import { BookOutputParser } from './application/book-output.parser';
import { BookOutputValidator } from './application/book-output.validator';
import { BOOK_GENERATION_USE_CASE } from './application/book-generation.use-case';
import { BookPersistenceService } from './application/book-persistence.service';
import {
  DesignBullMqJobQueue,
  DesignGenerationRunner,
} from './application/design-generation.runner';
import { DesignGenerationService } from './application/design-generation.service';
import {
  DESIGN_GENERATION_USE_CASE,
  DESIGN_JOB_QUEUE,
} from './application/design-generation.use-case';
import { DesignOutputParser } from './application/design-output.parser';
import { DesignOutputValidator } from './application/design-output.validator';
import { DesignPromptBuilderService } from './application/design-prompt-builder.service';
import { PresentationOutputParser } from './application/presentation-output.parser';
import { CommunicationOutputParser } from './application/communication-output.parser';
import { EpubBuilderService } from './application/epub-builder.service';
import { PdfBuilderService } from './application/pdf-builder.service';
import {
  EXPORT_GENERATION_USE_CASE,
  EXPORT_JOB_QUEUE,
} from './application/export-generation.use-case';
import { ExportGenerationService } from './application/export-generation.service';
import {
  ExportBullMqJobQueue,
  ExportGenerationRunner,
} from './application/export-generation.runner';
import { CommunicationOutputValidator } from './application/communication-output.validator';
import { CommunicationPromptBuilderService } from './application/communication-prompt-builder.service';
import {
  COMMUNICATION_GENERATION_USE_CASE,
  COMMUNICATION_JOB_QUEUE,
} from './application/communication-generation.use-case';
import { CommunicationGenerationService } from './application/communication-generation.service';
import {
  CommunicationBullMqJobQueue,
  CommunicationGenerationRunner,
} from './application/communication-generation.runner';
import { PresentationOutputValidator } from './application/presentation-output.validator';
import { PresentationPromptBuilderService } from './application/presentation-prompt-builder.service';
import {
  PRESENTATION_GENERATION_USE_CASE,
  PRESENTATION_JOB_QUEUE,
} from './application/presentation-generation.use-case';
import { PresentationGenerationService } from './application/presentation-generation.service';
import {
  PresentationBullMqJobQueue,
  PresentationGenerationRunner,
} from './application/presentation-generation.runner';
import { CircuitBreaker } from './application/circuit-breaker';
import { GenerationRunner } from './application/generation-runner';
import { JobStatusStream } from './application/job-status.stream';
import { PromptBuilderService } from './application/prompt-builder.service';
import { BooksModule } from '../books/books.module';
import { CommunicationsModule } from '../communications/communications.module';
import { DesignsModule } from '../designs/designs.module';
import { PresentationsModule } from '../presentations/presentations.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { IDEMPOTENCY_STORE } from '../common/idempotency/idempotency-store';
import { InMemoryIdempotencyStore } from '../common/idempotency/in-memory-idempotency.store';
import { RedisIdempotencyStore } from '../common/idempotency/redis-idempotency.store';
import { REDIS_CLIENT } from '../common/redis/redis-client';
import type { RedisClient } from '../common/redis/redis-client';
import { RedisModule } from '../common/redis/redis.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { ObservabilityModule } from '../observability/observability.module';
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
import { CredentialSecretProvider } from './secrets/credential-secret.provider';
import { CredentialResolver } from './secrets/credential-resolver';
import { CREDENTIAL_REPOSITORY } from './secrets/credential.repository';
import type { CredentialRepository } from './secrets/credential.repository';
import { InMemoryCredentialRepository } from './secrets/in-memory-credential.repository';
import { SupabaseCredentialRepository } from './secrets/supabase-credential.repository';
import {
  CRYPTO_SERVICE,
  CryptoService,
  parseMasterKey,
} from './secrets/crypto.service';
import type { CryptoServiceLike } from './secrets/crypto.service';
import { GeminiClientProvider } from './infrastructure/gemini/gemini-client.provider';
import { GeminiImageAdapter } from './infrastructure/gemini/gemini-image.adapter';
import { GeminiTextAdapter } from './infrastructure/gemini/gemini-text.adapter';
import { GeminiTtsAdapter } from './infrastructure/gemini/gemini-tts.adapter';
import { OpenRouterClient } from './infrastructure/openrouter/openrouter-client';
import { OpenRouterImageAdapter } from './infrastructure/openrouter/openrouter-image.adapter';
import { OpenRouterTextAdapter } from './infrastructure/openrouter/openrouter-text.adapter';
import { isOpenRouterEnabled } from './infrastructure/openrouter/openrouter.config';
import { AiCredentialsController } from './ai-credentials.controller';
import { AiCredentialsService } from './ai-credentials.service';
import {
  IMAGE_GENERATOR,
  SECRET_PROVIDER,
  TEXT_GENERATOR,
  TTS_GENERATOR,
} from './tokens';

@Module({
  imports: [
    SupabaseModule,
    RedisModule,
    ObservabilityModule,
    BooksModule,
    CommunicationsModule,
    DesignsModule,
    PresentationsModule,
    ProfilesModule,
  ],
  controllers: [AiController, AiCredentialsController, ExportsController],
  providers: [
    EnvSecretProvider,
    InMemoryCredentialRepository,
    {
      provide: CREDENTIAL_REPOSITORY,
      useFactory: (
        supabaseService: SupabaseService,
        memory: InMemoryCredentialRepository,
      ): CredentialRepository =>
        supabaseService.getClient()
          ? new SupabaseCredentialRepository(supabaseService)
          : memory,
      inject: [SupabaseService, InMemoryCredentialRepository],
    },
    {
      provide: CRYPTO_SERVICE,
      useFactory: (configService: ConfigService): CryptoServiceLike => {
        const key = parseMasterKey(
          configService.get<string>('AI_SECRETS_MASTER_KEY'),
        );

        return key ? new CryptoService(key) : null;
      },
      inject: [ConfigService],
    },
    CredentialResolver,
    {
      provide: SECRET_PROVIDER,
      useFactory: (
        configService: ConfigService,
        resolver: CredentialResolver,
      ) =>
        new CredentialSecretProvider(
          resolver,
          new EnvSecretProvider(configService),
        ),
      inject: [ConfigService, CredentialResolver],
    },
    GeminiClientProvider,
    GeminiTextAdapter,
    GeminiImageAdapter,
    OpenRouterClient,
    OpenRouterTextAdapter,
    OpenRouterImageAdapter,
    AiCredentialsService,
    {
      // Privacy gate (owner review, blocks activation): OpenRouter stays
      // off unless OPENROUTER_ENABLED=true (dev-only until reviewed).
      // TTS always stays on Gemini (out of scope for SPEC-033).
      provide: TEXT_GENERATOR,
      useFactory: (
        configService: ConfigService,
        gemini: GeminiTextAdapter,
        openRouter: OpenRouterTextAdapter,
      ) => (isOpenRouterEnabled(configService) ? openRouter : gemini),
      inject: [ConfigService, GeminiTextAdapter, OpenRouterTextAdapter],
    },
    {
      provide: IMAGE_GENERATOR,
      useFactory: (
        configService: ConfigService,
        gemini: GeminiImageAdapter,
        openRouter: OpenRouterImageAdapter,
      ) => (isOpenRouterEnabled(configService) ? openRouter : gemini),
      inject: [ConfigService, GeminiImageAdapter, OpenRouterImageAdapter],
    },
    { provide: TTS_GENERATOR, useClass: GeminiTtsAdapter },
    InMemoryIdempotencyStore,
    {
      provide: IDEMPOTENCY_STORE,
      useFactory: (redis: RedisClient, memory: InMemoryIdempotencyStore) =>
        redis ? new RedisIdempotencyStore(redis) : memory,
      inject: [REDIS_CLIENT, InMemoryIdempotencyStore],
    },
    PromptBuilderService,
    DesignPromptBuilderService,
    BookOutputParser,
    BookOutputValidator,
    DesignOutputParser,
    DesignOutputValidator,
    PresentationPromptBuilderService,
    PresentationOutputParser,
    PresentationOutputValidator,
    CommunicationPromptBuilderService,
    CommunicationOutputParser,
    CommunicationOutputValidator,
    EpubBuilderService,
    PdfBuilderService,
    ExportGenerationService,
    ExportGenerationRunner,
    BookPersistenceService,
    DesignGenerationService,
    DesignGenerationRunner,
    PresentationGenerationService,
    PresentationGenerationRunner,
    CommunicationGenerationService,
    CommunicationGenerationRunner,
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
        logger: PinoLogger,
      ): JobQueue => {
        if (resolveQueueDriver(configService) === 'bullmq') {
          if (!redis) {
            throw new Error('REDIS_URL is required for QUEUE_DRIVER=bullmq');
          }

          return new BullMqJobQueue(redis, runner, jobs, logger);
        }

        return new InlineJobQueue(runner, jobs);
      },
      inject: [
        ConfigService,
        REDIS_CLIENT,
        GenerationRunner,
        JOB_REPOSITORY,
        PinoLogger,
      ],
    },
    JobStatusStream,
    {
      provide: BOOK_GENERATION_USE_CASE,
      useClass: BookGenerationService,
    },
    {
      provide: DESIGN_GENERATION_USE_CASE,
      useClass: DesignGenerationService,
    },
    {
      provide: PRESENTATION_GENERATION_USE_CASE,
      useClass: PresentationGenerationService,
    },
    {
      provide: COMMUNICATION_GENERATION_USE_CASE,
      useClass: CommunicationGenerationService,
    },
    {
      provide: EXPORT_GENERATION_USE_CASE,
      useClass: ExportGenerationService,
    },
    // DesignBullMqJobQueue lifecycle is factory-owned (same as
    // BullMqJobQueue): constructed only when QUEUE_DRIVER=bullmq so no
    // stray worker boots.
    {
      provide: DESIGN_JOB_QUEUE,
      useFactory: (
        configService: ConfigService,
        redis: RedisClient,
        runner: DesignGenerationRunner,
        jobs: JobRepository,
        logger: PinoLogger,
      ): JobQueue => {
        if (resolveQueueDriver(configService) === 'bullmq') {
          if (!redis) {
            throw new Error('REDIS_URL is required for QUEUE_DRIVER=bullmq');
          }

          return new DesignBullMqJobQueue(redis, runner, jobs, logger);
        }

        // InlineJobQueue only invokes run(jobId, correlationId), which the
        // design runner implements; the cast keeps the shared queue code
        // untouched (SPEC-029: no book refactors).
        return new InlineJobQueue(runner as unknown as GenerationRunner, jobs);
      },
      inject: [
        ConfigService,
        REDIS_CLIENT,
        DesignGenerationRunner,
        JOB_REPOSITORY,
        PinoLogger,
      ],
    },
    // PresentationBullMqJobQueue lifecycle is factory-owned (same as
    // BullMqJobQueue): constructed only when QUEUE_DRIVER=bullmq so no
    // stray worker boots.
    {
      provide: PRESENTATION_JOB_QUEUE,
      useFactory: (
        configService: ConfigService,
        redis: RedisClient,
        runner: PresentationGenerationRunner,
        jobs: JobRepository,
        logger: PinoLogger,
      ): JobQueue => {
        if (resolveQueueDriver(configService) === 'bullmq') {
          if (!redis) {
            throw new Error('REDIS_URL is required for QUEUE_DRIVER=bullmq');
          }

          return new PresentationBullMqJobQueue(redis, runner, jobs, logger);
        }

        // InlineJobQueue only invokes run(jobId, correlationId), which the
        // presentation runner implements; the cast keeps the shared queue
        // code untouched (SPEC-029B: no book/design refactors).
        return new InlineJobQueue(runner as unknown as GenerationRunner, jobs);
      },
      inject: [
        ConfigService,
        REDIS_CLIENT,
        PresentationGenerationRunner,
        JOB_REPOSITORY,
        PinoLogger,
      ],
    },
    // CommunicationBullMqJobQueue lifecycle is factory-owned (same as
    // BullMqJobQueue): constructed only when QUEUE_DRIVER=bullmq so no
    // stray worker boots.
    {
      provide: COMMUNICATION_JOB_QUEUE,
      useFactory: (
        configService: ConfigService,
        redis: RedisClient,
        runner: CommunicationGenerationRunner,
        jobs: JobRepository,
        logger: PinoLogger,
      ): JobQueue => {
        if (resolveQueueDriver(configService) === 'bullmq') {
          if (!redis) {
            throw new Error('REDIS_URL is required for QUEUE_DRIVER=bullmq');
          }

          return new CommunicationBullMqJobQueue(redis, runner, jobs, logger);
        }

        // InlineJobQueue only invokes run(jobId, correlationId), which the
        // board runner implements; the cast keeps the shared queue code
        // untouched (SPEC-029C: no book/design/presentation refactors).
        return new InlineJobQueue(runner as unknown as GenerationRunner, jobs);
      },
      inject: [
        ConfigService,
        REDIS_CLIENT,
        CommunicationGenerationRunner,
        JOB_REPOSITORY,
        PinoLogger,
      ],
    },
    // ExportBullMqJobQueue lifecycle is factory-owned (same as
    // BullMqJobQueue): constructed only when QUEUE_DRIVER=bullmq so no
    // stray worker boots.
    {
      provide: EXPORT_JOB_QUEUE,
      useFactory: (
        configService: ConfigService,
        redis: RedisClient,
        runner: ExportGenerationRunner,
        jobs: JobRepository,
        logger: PinoLogger,
      ): JobQueue => {
        if (resolveQueueDriver(configService) === 'bullmq') {
          if (!redis) {
            throw new Error('REDIS_URL is required for QUEUE_DRIVER=bullmq');
          }

          return new ExportBullMqJobQueue(redis, runner, jobs, logger);
        }

        // InlineJobQueue only invokes run(jobId, correlationId), which the
        // export runner implements; the cast keeps the shared queue code
        // untouched (SPEC-031: no book/ai refactors).
        return new InlineJobQueue(runner as unknown as GenerationRunner, jobs);
      },
      inject: [
        ConfigService,
        REDIS_CLIENT,
        ExportGenerationRunner,
        JOB_REPOSITORY,
        PinoLogger,
      ],
    },
  ],
  exports: [TEXT_GENERATOR, IMAGE_GENERATOR, TTS_GENERATOR],
})
export class AiModule {}
