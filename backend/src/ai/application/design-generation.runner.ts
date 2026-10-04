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
  DESIGN_REPOSITORY,
  type DesignRepository,
} from '../../designs/design.repository';
import { isDesignFlagEnabled } from '../domain/design-generation.types';
import type { ImageGeneratorPort } from '../domain/ports/image-generator.port';
import type { TextGeneratorPort } from '../domain/ports/text-generator.port';
import { DEFAULT_SIGNED_URL_TTL_SECONDS } from './book-persistence.service';
import { IMAGE_GENERATOR, TEXT_GENERATOR } from '../tokens';
import { CircuitBreaker } from './circuit-breaker';
import {
  DESIGN_GENERATION_QUEUE,
  type DesignGenerationCommand,
  type DesignJobPayload,
} from './design-generation.use-case';
import { DesignOutputParser } from './design-output.parser';
import { DesignOutputValidator } from './design-output.validator';
import {
  DESIGN_MAX_OUTPUT_TOKENS,
  DESIGN_TEMPERATURE,
  DesignPromptBuilderService,
} from './design-prompt-builder.service';

export const DESIGN_IMAGE_ASPECT_RATIO = '1:1';
export const DESIGN_IMAGE_SIZE = '1K' as const;

@Injectable()
export class DesignGenerationRunner {
  constructor(
    @Inject(JOB_REPOSITORY) private readonly jobs: JobRepository,
    private readonly promptBuilder: DesignPromptBuilderService,
    private readonly parser: DesignOutputParser,
    private readonly validator: DesignOutputValidator,
    private readonly breaker: CircuitBreaker,
    @Inject(DESIGN_REPOSITORY) private readonly designs: DesignRepository,
    @Inject(BOOK_STORAGE) private readonly storage: BookStorage,
    @Inject(TEXT_GENERATOR) private readonly textGenerator: TextGeneratorPort,
    @Inject(IMAGE_GENERATOR)
    private readonly imageGenerator: ImageGeneratorPort,
    private readonly configService: ConfigService,
    private readonly logger: PinoLogger,
    private readonly metrics: MetricsService,
  ) {
    this.logger.setContext(DesignGenerationRunner.name);
  }

  async run(jobId: string, correlationId?: string): Promise<void> {
    const startedAt = Date.now();
    const context = {
      jobId,
      ...(correlationId ? { correlationId } : {}),
    };
    this.logger.info(context, 'Running design generation');

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
        'Design generation completed',
      );
    } catch (error) {
      const latencyMs = Date.now() - startedAt;
      this.metrics.recordGeneration({ success: false, latencyMs });
      this.logger.error(
        { ...context, latencyMs, err: error },
        'Design generation failed',
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
      !isDesignFlagEnabled(
        this.configService.get<boolean>('DESIGN_IMAGES_ENABLED'),
      )
    ) {
      throw new AiErrorException(
        501,
        'NOT_IMPLEMENTED',
        'Design image generation is disabled',
      );
    }

    // The job request envelope is vertical-agnostic; design jobs carry the
    // flyer brief in the same slot books use for the story brief.
    const request = job.request as unknown as DesignGenerationCommand;
    const audience = request.audience ?? 'child';
    const designPrompt = this.promptBuilder.build({
      ...request,
      audience,
      userId: job.userId,
    });
    const result = await this.breaker.execute(() =>
      this.textGenerator.generate({
        prompt: designPrompt.prompt,
        systemInstruction: designPrompt.systemInstruction,
        temperature: DESIGN_TEMPERATURE,
        maxOutputTokens: DESIGN_MAX_OUTPUT_TOKENS,
        responseJsonSchema: designPrompt.responseJsonSchema,
        tenantId: job.userId,
      }),
    );
    const payload = this.parser.parse(result.text);
    const design = this.validator.validate(payload, audience);

    // The image is REQUIRED for a flyer: any adapter or storage failure
    // aborts before persisting, so there is never a partial design.
    const image = await this.imageGenerator.generate({
      prompt: design.imagePrompt,
      aspectRatio: DESIGN_IMAGE_ASPECT_RATIO,
      imageSize: DESIGN_IMAGE_SIZE,
    });
    const imagePath = buildDesignImagePath(job.userId, jobId);
    await this.storage.upload(imagePath, image.data, image.mimeType);

    // SPEC-033: per-response provider cost is the reported text cost plus
    // the reported image cost; undefined when neither adapter reports one
    // (Gemini default path). Failures record no cost (run() catch path).
    const textCost = result.usage?.costUsd;
    const imageCost = image.usage?.costUsd;
    const costUsd =
      textCost !== undefined || imageCost !== undefined
        ? (textCost ?? 0) + (imageCost ?? 0)
        : undefined;

    const stored = await this.designs.save({
      userId: job.userId,
      profileId: request.profileId,
      snapshot: {
        title: design.title,
        message: design.message,
        occasion: request.occasion,
        style: request.style,
        audience,
        imagePath,
        imagePrompt: design.imagePrompt,
      },
      audit: {
        promptVersion: designPrompt.version,
        model: result.model,
        inputTokens: result.usage?.inputTokens,
        outputTokens: result.usage?.outputTokens,
        ...(costUsd !== undefined ? { costUsd } : {}),
        generationJobId: jobId,
        createdBy: job.userId,
      },
    });

    // The generic job envelope carries the flyer for polling/SSE; only the
    // storage path is persisted, signed URLs are minted on read.
    const ttlSeconds =
      this.configService.get<number>('BOOK_IMAGE_SIGNED_URL_TTL_SECONDS') ??
      DEFAULT_SIGNED_URL_TTL_SECONDS;
    const imageUrl = await this.storage.signedUrl(imagePath, ttlSeconds);

    await this.jobs.complete(jobId, {
      id: stored.id,
      title: stored.title,
      totalPages: 1,
      pages: [
        {
          pageNumber: 1,
          content: stored.version.message,
          imagePrompt: stored.version.imagePrompt,
          imageUrl,
        },
      ],
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

export function buildDesignImagePath(
  userId: string,
  generationJobId: string,
): string {
  return `designs/users/${userId}/jobs/${generationJobId}.png`;
}

/**
 * SPEC-029 — BullMQ execution boundary for flyer designs.
 *
 * Lives next to the runner it invokes: the shared BullMqJobQueue is pinned
 * to the book queue and the book runner, so designs need their own queue
 * (`design-generation`) and worker with the same retry/backoff semantics.
 */
@Injectable()
export class DesignBullMqJobQueue
  implements JobQueue, OnModuleInit, OnModuleDestroy
{
  private queue?: Queue<DesignJobPayload>;
  private worker?: Worker<DesignJobPayload>;
  private workerConnection?: Redis;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly runner: DesignGenerationRunner,
    @Inject(JOB_REPOSITORY) private readonly jobs: JobRepository,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(DesignBullMqJobQueue.name);
  }

  async onModuleInit(): Promise<void> {
    await assertRedisAvailable(this.redis);

    this.queue = new Queue<DesignJobPayload>(DESIGN_GENERATION_QUEUE, {
      connection: this.redis,
    });
    this.workerConnection = this.redis.duplicate();
    this.worker = new Worker<DesignJobPayload>(
      DESIGN_GENERATION_QUEUE,
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
        `Design generation job failed: ${error.message}`,
      );
    });
  }

  async enqueue(jobId: string, correlationId?: string): Promise<void> {
    if (!this.queue) {
      throw new Error('Design BullMQ queue is not initialized');
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

  private async process(job: Job<DesignJobPayload>): Promise<void> {
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
