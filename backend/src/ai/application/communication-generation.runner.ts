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
  COMMUNICATION_REPOSITORY,
  type CommunicationCellSnapshot,
  type CommunicationRepository,
} from '../../communications/communication.repository';
import { isCommunicationFlagEnabled } from '../domain/communication-generation.types';
import type { ImageGeneratorPort } from '../domain/ports/image-generator.port';
import type { TextGeneratorPort } from '../domain/ports/text-generator.port';
import { DEFAULT_SIGNED_URL_TTL_SECONDS } from './book-persistence.service';
import { IMAGE_GENERATOR, TEXT_GENERATOR } from '../tokens';
import { CircuitBreaker } from './circuit-breaker';
import {
  COMMUNICATION_GENERATION_QUEUE,
  type CommunicationGenerationCommand,
  type CommunicationJobPayload,
} from './communication-generation.use-case';
import { CommunicationOutputParser } from './communication-output.parser';
import { CommunicationOutputValidator } from './communication-output.validator';
import {
  COMMUNICATION_MAX_OUTPUT_TOKENS,
  COMMUNICATION_TEMPERATURE,
  CommunicationPromptBuilderService,
} from './communication-prompt-builder.service';

export const COMMUNICATION_IMAGE_ASPECT_RATIO = '1:1';
export const COMMUNICATION_IMAGE_SIZE = '1K' as const;

@Injectable()
export class CommunicationGenerationRunner {
  constructor(
    @Inject(JOB_REPOSITORY) private readonly jobs: JobRepository,
    private readonly promptBuilder: CommunicationPromptBuilderService,
    private readonly parser: CommunicationOutputParser,
    private readonly validator: CommunicationOutputValidator,
    private readonly breaker: CircuitBreaker,
    @Inject(COMMUNICATION_REPOSITORY)
    private readonly communications: CommunicationRepository,
    @Inject(BOOK_STORAGE) private readonly storage: BookStorage,
    @Inject(TEXT_GENERATOR) private readonly textGenerator: TextGeneratorPort,
    @Inject(IMAGE_GENERATOR)
    private readonly imageGenerator: ImageGeneratorPort,
    private readonly configService: ConfigService,
    private readonly logger: PinoLogger,
    private readonly metrics: MetricsService,
  ) {
    this.logger.setContext(CommunicationGenerationRunner.name);
  }

  async run(jobId: string, correlationId?: string): Promise<void> {
    const startedAt = Date.now();
    const context = {
      jobId,
      ...(correlationId ? { correlationId } : {}),
    };
    this.logger.info(context, 'Running board generation');

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
      this.logger.info({ ...context, latencyMs }, 'Board generation completed');
    } catch (error) {
      const latencyMs = Date.now() - startedAt;
      this.metrics.recordGeneration({ success: false, latencyMs });
      this.logger.error(
        { ...context, latencyMs, err: error },
        'Board generation failed',
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
      !isCommunicationFlagEnabled(
        this.configService.get<boolean>('COMMUNICATION_IMAGES_ENABLED'),
      )
    ) {
      throw new AiErrorException(
        501,
        'NOT_IMPLEMENTED',
        'Board image generation is disabled',
      );
    }

    // The job request envelope is vertical-agnostic; board jobs carry the
    // board brief in the same slot books use for the story brief.
    const request = job.request as unknown as CommunicationGenerationCommand;
    const audience = request.audience ?? 'child';
    const cellCount = request.cellCount;
    const boardPrompt = this.promptBuilder.build({
      ...request,
      audience,
      userId: job.userId,
    });
    const result = await this.breaker.execute(() =>
      this.textGenerator.generate({
        prompt: boardPrompt.prompt,
        systemInstruction: boardPrompt.systemInstruction,
        temperature: COMMUNICATION_TEMPERATURE,
        maxOutputTokens: COMMUNICATION_MAX_OUTPUT_TOKENS,
        responseJsonSchema: boardPrompt.responseJsonSchema,
        tenantId: job.userId,
      }),
    );
    const payload = this.parser.parse(result.text);
    const board = this.validator.validate(payload, audience, cellCount);

    // Every cell image is REQUIRED: any adapter or storage failure aborts
    // before persisting, so there is never a partial board.
    const cells: CommunicationCellSnapshot[] = [];
    let imageCostTotal: number | undefined;
    let imageCostSeen = false;
    for (let index = 0; index < board.cells.length; index += 1) {
      const cell = board.cells[index];
      const image = await this.imageGenerator.generate({
        prompt: cell.imagePrompt,
        aspectRatio: COMMUNICATION_IMAGE_ASPECT_RATIO,
        imageSize: COMMUNICATION_IMAGE_SIZE,
      });
      const imagePath = buildCommunicationImagePath(job.userId, jobId, index);
      await this.storage.upload(imagePath, image.data, image.mimeType);
      cells.push({
        label: cell.label,
        imagePath,
        imagePrompt: cell.imagePrompt,
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

    const stored = await this.communications.save({
      userId: job.userId,
      profileId: request.profileId,
      snapshot: {
        title: board.title,
        kind: request.kind,
        topic: request.topic,
        style: request.style,
        audience,
        cellCount: board.cells.length,
        cells,
      },
      audit: {
        promptVersion: boardPrompt.version,
        model: result.model,
        inputTokens: result.usage?.inputTokens,
        outputTokens: result.usage?.outputTokens,
        ...(costUsd !== undefined ? { costUsd } : {}),
        generationJobId: jobId,
        createdBy: job.userId,
      },
    });

    // The generic job envelope carries the board for polling/SSE: cells ride
    // as pages so the shared envelope shape stays untouched; only the
    // storage paths are persisted, signed URLs are minted on read.
    const ttlSeconds =
      this.configService.get<number>('BOOK_IMAGE_SIGNED_URL_TTL_SECONDS') ??
      DEFAULT_SIGNED_URL_TTL_SECONDS;

    const pages = [];
    for (let index = 0; index < stored.version.cells.length; index += 1) {
      const cell = stored.version.cells[index];
      pages.push({
        pageNumber: index + 1,
        content: cell.label,
        imagePrompt: cell.imagePrompt,
        imageUrl: cell.imagePath
          ? await this.storage.signedUrl(cell.imagePath, ttlSeconds)
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

export function buildCommunicationImagePath(
  userId: string,
  generationJobId: string,
  cellIndex: number,
): string {
  return `communications/users/${userId}/jobs/${generationJobId}/cell-${cellIndex}.png`;
}

/**
 * SPEC-029C — BullMQ execution boundary for boards.
 *
 * Lives next to the runner it invokes: the shared BullMqJobQueue is pinned
 * to the book queue and the book runner, so boards need their own queue
 * (`communication-generation`) and worker with the same retry/backoff
 * semantics.
 */
@Injectable()
export class CommunicationBullMqJobQueue
  implements JobQueue, OnModuleInit, OnModuleDestroy
{
  private queue?: Queue<CommunicationJobPayload>;
  private worker?: Worker<CommunicationJobPayload>;
  private workerConnection?: Redis;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly runner: CommunicationGenerationRunner,
    @Inject(JOB_REPOSITORY) private readonly jobs: JobRepository,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(CommunicationBullMqJobQueue.name);
  }

  async onModuleInit(): Promise<void> {
    await assertRedisAvailable(this.redis);

    this.queue = new Queue<CommunicationJobPayload>(
      COMMUNICATION_GENERATION_QUEUE,
      {
        connection: this.redis,
      },
    );
    this.workerConnection = this.redis.duplicate();
    this.worker = new Worker<CommunicationJobPayload>(
      COMMUNICATION_GENERATION_QUEUE,
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
        `Board generation job failed: ${error.message}`,
      );
    });
  }

  async enqueue(jobId: string, correlationId?: string): Promise<void> {
    if (!this.queue) {
      throw new Error('Communication BullMQ queue is not initialized');
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

  private async process(job: Job<CommunicationJobPayload>): Promise<void> {
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
