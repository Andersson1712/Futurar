import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue, Worker } from 'bullmq';
import type { Redis } from 'ioredis';
import { PinoLogger } from 'nestjs-pino';
import { BOOK_STORAGE } from '../../books/book-storage.port';
import type { BookStorage } from '../../books/book-storage.port';
import { AiErrorException } from '../../common/errors/ai-error.exception';
import { toAiErrorDto } from '../../common/errors/to-ai-error';
import {
  assertRedisAvailable,
  REDIS_CLIENT,
} from '../../common/redis/redis-client';
import { JOB_REPOSITORY } from '../../jobs/job.repository';
import type { JobRepository } from '../../jobs/job.repository';
import type { JobQueue } from '../../jobs/job-queue.port';
import { MetricsService } from '../../observability/metrics.service';
import {
  PRESENTATION_REPOSITORY,
  type PresentationRepository,
  type PresentationSlideSnapshot,
} from '../../presentations/presentation.repository';
import { isPresentationFlagEnabled } from '../domain/presentation-generation.types';
import type { ImageGeneratorPort } from '../domain/ports/image-generator.port';
import type { TextGeneratorPort } from '../domain/ports/text-generator.port';
import { DEFAULT_SIGNED_URL_TTL_SECONDS } from './book-persistence.service';
import { IMAGE_GENERATOR, TEXT_GENERATOR } from '../tokens';
import { CircuitBreaker } from './circuit-breaker';
import {
  PRESENTATION_GENERATION_QUEUE,
  type PresentationGenerationCommand,
  type PresentationJobPayload,
} from './presentation-generation.use-case';
import { PresentationOutputParser } from './presentation-output.parser';
import { PresentationOutputValidator } from './presentation-output.validator';
import {
  PRESENTATION_MAX_OUTPUT_TOKENS,
  PRESENTATION_TEMPERATURE,
  PresentationPromptBuilderService,
} from './presentation-prompt-builder.service';

export const PRESENTATION_IMAGE_ASPECT_RATIO = '16:9';
export const PRESENTATION_IMAGE_SIZE = '1K' as const;

@Injectable()
export class PresentationGenerationRunner {
  constructor(
    @Inject(JOB_REPOSITORY) private readonly jobs: JobRepository,
    private readonly promptBuilder: PresentationPromptBuilderService,
    private readonly parser: PresentationOutputParser,
    private readonly validator: PresentationOutputValidator,
    private readonly breaker: CircuitBreaker,
    @Inject(PRESENTATION_REPOSITORY)
    private readonly presentations: PresentationRepository,
    @Inject(BOOK_STORAGE) private readonly storage: BookStorage,
    @Inject(TEXT_GENERATOR) private readonly textGenerator: TextGeneratorPort,
    @Inject(IMAGE_GENERATOR)
    private readonly imageGenerator: ImageGeneratorPort,
    private readonly configService: ConfigService,
    private readonly logger: PinoLogger,
    private readonly metrics: MetricsService,
  ) {
    this.logger.setContext(PresentationGenerationRunner.name);
  }

  async run(jobId: string, correlationId?: string): Promise<void> {
    const startedAt = Date.now();
    const context = {
      jobId,
      ...(correlationId ? { correlationId } : {}),
    };
    this.logger.info(context, 'Running presentation generation');

    try {
      const usage = await this.execute(jobId);

      const latencyMs = Date.now() - startedAt;
      this.metrics.recordGeneration({
        success: true,
        latencyMs,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        costUsd: usage.costUsd,
      });
      this.logger.info(
        { ...context, latencyMs },
        'Presentation generation completed',
      );
    } catch (error) {
      const latencyMs = Date.now() - startedAt;
      this.metrics.recordGeneration({ success: false, latencyMs });
      this.logger.error(
        { ...context, latencyMs, err: error },
        'Presentation generation failed',
      );
      throw error;
    }
  }

  private async execute(jobId: string): Promise<{
    inputTokens?: number;
    outputTokens?: number;
    costUsd?: number;
  }> {
    const job = await this.jobs.findById(jobId);

    if (!job) {
      throw new AiErrorException(404, 'NOT_FOUND', 'Job not found');
    }

    await this.jobs.markProcessing(jobId);

    if (
      !isPresentationFlagEnabled(
        this.configService.get<boolean>('PRESENTATION_IMAGES_ENABLED'),
      )
    ) {
      throw new AiErrorException(
        501,
        'NOT_IMPLEMENTED',
        'Presentation image generation is disabled',
      );
    }

    // The job request envelope is vertical-agnostic; presentation jobs carry
    // the deck brief in the same slot books use for the story brief.
    const request = job.request as unknown as PresentationGenerationCommand;
    const audience = request.audience ?? 'child';
    const slideCount = request.slideCount;
    const presentationPrompt = this.promptBuilder.build({
      ...request,
      audience,
      userId: job.userId,
    });
    const result = await this.breaker.execute(() =>
      this.textGenerator.generate({
        prompt: presentationPrompt.prompt,
        systemInstruction: presentationPrompt.systemInstruction,
        temperature: PRESENTATION_TEMPERATURE,
        maxOutputTokens: PRESENTATION_MAX_OUTPUT_TOKENS,
        responseJsonSchema: presentationPrompt.responseJsonSchema,
        tenantId: job.userId,
      }),
    );
    const payload = this.parser.parse(result.text);
    const presentation = this.validator.validate(payload, audience, slideCount);

    // Every slide image is REQUIRED: any adapter or storage failure aborts
    // before persisting, so there is never a partial presentation.
    const slides: PresentationSlideSnapshot[] = [];
    let imageCostTotal: number | undefined;
    let imageCostSeen = false;
    for (let index = 0; index < presentation.slides.length; index += 1) {
      const slide = presentation.slides[index];
      const image = await this.imageGenerator.generate({
        prompt: slide.imagePrompt,
        aspectRatio: PRESENTATION_IMAGE_ASPECT_RATIO,
        imageSize: PRESENTATION_IMAGE_SIZE,
      });
      const imagePath = buildPresentationImagePath(job.userId, jobId, index);
      await this.storage.upload(imagePath, image.data, image.mimeType);
      slides.push({
        title: slide.title,
        bullets: slide.bullets,
        imagePath,
        imagePrompt: slide.imagePrompt,
      });
      if (image.usage?.costUsd !== undefined) {
        imageCostSeen = true;
        imageCostTotal = (imageCostTotal ?? 0) + image.usage.costUsd;
      }
    }

    // SPEC-033: per-response provider cost is the reported text cost plus
    // the reported image cost; undefined when neither adapter reports one
    // (Gemini default path). Failures record no cost (run() catch path).
    const textCost = result.usage?.costUsd;
    const costUsd =
      textCost !== undefined || imageCostSeen
        ? (textCost ?? 0) + (imageCostTotal ?? 0)
        : undefined;

    const stored = await this.presentations.save({
      userId: job.userId,
      profileId: request.profileId,
      snapshot: {
        title: presentation.title,
        topic: request.topic,
        style: request.style,
        audience,
        slideCount: presentation.slides.length,
        slides,
      },
      audit: {
        promptVersion: presentationPrompt.version,
        model: result.model,
        inputTokens: result.usage?.inputTokens,
        outputTokens: result.usage?.outputTokens,
        ...(costUsd !== undefined ? { costUsd } : {}),
        generationJobId: jobId,
        createdBy: job.userId,
      },
    });

    // The generic job envelope carries the deck for polling/SSE; only the
    // storage paths are persisted, signed URLs are minted on read.
    const ttlSeconds =
      this.configService.get<number>('BOOK_IMAGE_SIGNED_URL_TTL_SECONDS') ??
      DEFAULT_SIGNED_URL_TTL_SECONDS;

    const pages = [];
    for (let index = 0; index < stored.version.slides.length; index += 1) {
      const slide = stored.version.slides[index];
      pages.push({
        pageNumber: index + 1,
        content: `${slide.title}\n${slide.bullets.join('\n')}`,
        imagePrompt: slide.imagePrompt,
        imageUrl: slide.imagePath
          ? await this.storage.signedUrl(slide.imagePath, ttlSeconds)
          : undefined,
      });
    }

    await this.jobs.complete(jobId, {
      id: stored.id,
      title: stored.title,
      totalPages: pages.length,
      pages,
    });

    if (costUsd !== undefined) {
      await this.jobs.recordCost(jobId, costUsd);
    }

    return {
      inputTokens: result.usage?.inputTokens,
      outputTokens: result.usage?.outputTokens,
      costUsd,
    };
  }
}

export function buildPresentationImagePath(
  userId: string,
  generationJobId: string,
  slideIndex: number,
): string {
  return `presentations/users/${userId}/jobs/${generationJobId}/slide-${slideIndex}.png`;
}

/**
 * SPEC-029B — BullMQ execution boundary for presentations.
 *
 * Lives next to the runner it invokes: the shared BullMqJobQueue is pinned
 * to the book queue and the book runner, so presentations need their own
 * queue (`presentation-generation`) and worker with the same retry/backoff
 * semantics.
 */
@Injectable()
export class PresentationBullMqJobQueue
  implements JobQueue, OnModuleInit, OnModuleDestroy
{
  private queue?: Queue<PresentationJobPayload>;
  private worker?: Worker<PresentationJobPayload>;
  private workerConnection?: Redis;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly runner: PresentationGenerationRunner,
    @Inject(JOB_REPOSITORY) private readonly jobs: JobRepository,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(PresentationBullMqJobQueue.name);
  }

  async onModuleInit(): Promise<void> {
    await assertRedisAvailable(this.redis);

    this.queue = new Queue<PresentationJobPayload>(
      PRESENTATION_GENERATION_QUEUE,
      {
        connection: this.redis,
      },
    );
    this.workerConnection = this.redis.duplicate();
    this.worker = new Worker<PresentationJobPayload>(
      PRESENTATION_GENERATION_QUEUE,
      (job) => this.process(job),
      {
        connection: this.workerConnection,
        concurrency: 1,
      },
    );
    this.worker.on('failed', (job, error) => {
      this.logger.warn(
        {
          jobId: job?.data.jobId ?? 'unknown',
          correlationId: job?.data.correlationId,
        },
        `Presentation generation job failed: ${error.message}`,
      );
    });
  }

  async enqueue(jobId: string, correlationId?: string): Promise<void> {
    if (!this.queue) {
      throw new Error('Presentation BullMQ queue is not initialized');
    }

    await this.queue.add(
      'generate',
      { jobId, ...(correlationId ? { correlationId } : {}) },
      {
        jobId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close().catch(() => undefined);
    await this.queue?.close().catch(() => undefined);
    await this.workerConnection?.quit().catch(() => undefined);
  }

  private async process(job: Job<PresentationJobPayload>): Promise<void> {
    const { jobId, correlationId } = job.data;

    try {
      await this.runner.run(jobId, correlationId);
    } catch (error) {
      const attempts = job.opts.attempts ?? 1;

      if (job.attemptsMade + 1 >= attempts) {
        await this.jobs.fail(jobId, toAiErrorDto(error)).catch(() => undefined);
      }

      throw error;
    }
  }
}
