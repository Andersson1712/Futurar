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
  BOOK_REPOSITORY,
  type BookRepository,
} from '../../books/book.repository';
import { isExportFlagEnabled } from '../domain/export-generation.types';
import { CircuitBreaker } from './circuit-breaker';
import {
  EXPORT_GENERATION_QUEUE,
  type ExportGenerationCommand,
  type ExportJobPayload,
} from './export-generation.use-case';
import {
  EpubBuilderService,
  type EpubImageInput,
} from './epub-builder.service';

export const EXPORT_ARTIFACT_MIME_TYPE = 'application/epub+zip';

@Injectable()
export class ExportGenerationRunner {
  constructor(
    @Inject(JOB_REPOSITORY) private readonly jobs: JobRepository,
    private readonly epubBuilder: EpubBuilderService,
    private readonly breaker: CircuitBreaker,
    @Inject(BOOK_REPOSITORY) private readonly books: BookRepository,
    @Inject(BOOK_STORAGE) private readonly storage: BookStorage,
    private readonly configService: ConfigService,
    private readonly logger: PinoLogger,
    private readonly metrics: MetricsService,
  ) {
    this.logger.setContext(ExportGenerationRunner.name);
  }

  async run(jobId: string, correlationId?: string): Promise<void> {
    const startedAt = Date.now();
    const context = {
      jobId,
      ...(correlationId ? { correlationId } : {}),
    };
    this.logger.info(context, 'Running book export');

    try {
      await this.execute(jobId);

      const latencyMs = Date.now() - startedAt;
      this.metrics.recordGeneration({ success: true, latencyMs });
      this.logger.info({ ...context, latencyMs }, 'Book export completed');
    } catch (error) {
      const latencyMs = Date.now() - startedAt;
      this.metrics.recordGeneration({ success: false, latencyMs });
      this.logger.error(
        { ...context, latencyMs, err: error },
        'Book export failed',
      );
      throw error;
    }
  }

  private async execute(jobId: string): Promise<void> {
    const job = await this.jobs.findById(jobId);

    if (!job) {
      throw new AiErrorException(404, 'NOT_FOUND', 'Job not found');
    }

    await this.jobs.markProcessing(jobId);

    if (
      !isExportFlagEnabled(this.configService.get<boolean>('EXPORTS_ENABLED'))
    ) {
      throw new AiErrorException(
        501,
        'NOT_IMPLEMENTED',
        'Export endpoints are disabled',
      );
    }

    // The job request envelope is vertical-agnostic; export jobs carry the
    // export brief in the same slot books use for the story brief.
    const request = job.request as unknown as ExportGenerationCommand;
    const format = request.format as string;

    if (format !== 'epub') {
      throw new AiErrorException(
        501,
        'NOT_IMPLEMENTED',
        `Export format '${format}' is not supported yet`,
      );
    }

    const book = await this.books.findById(request.bookId, job.userId);

    if (!book) {
      throw new AiErrorException(404, 'NOT_FOUND', 'Book not found');
    }

    // Book images are optional enrichments (SPEC-008): a missing image is
    // skipped so one absent file never sinks the whole export.
    const images: EpubImageInput[] = [];
    const imageByPage = new Map<number, string>();
    for (const page of book.version.pages) {
      if (!page.imagePath) continue;

      try {
        const data = await this.breaker.execute(() =>
          this.storage.download(page.imagePath as string),
        );
        const fileName = `page-${page.pageNumber}${guessExtension(page.imagePath)}`;
        images.push({
          fileName,
          data,
          mimeType: guessMimeType(page.imagePath),
        });
        imageByPage.set(page.pageNumber, fileName);
      } catch (error) {
        this.logger.warn(
          { jobId, pageNumber: page.pageNumber, err: error },
          'Skipping book page image for export',
        );
      }
    }

    const epub = await this.epubBuilder.build({
      title: book.title,
      identifier: book.id,
      dedication: book.version.dedication ?? book.dedication?.to,
      pages: book.version.pages.map((page) => ({
        pageNumber: page.pageNumber,
        content: page.content,
        imageFileName: imageByPage.get(page.pageNumber),
      })),
      images,
    });

    const artifactPath = buildExportArtifactPath(job.userId, jobId);
    await this.storage.upload(artifactPath, epub, EXPORT_ARTIFACT_MIME_TYPE);

    await this.jobs.complete(jobId, {
      id: book.id,
      title: book.title,
      totalPages: book.version.pages.length,
      pages: book.version.pages.map((page) => ({
        pageNumber: page.pageNumber,
        content: page.content,
      })),
    });
  }
}

export function buildExportArtifactPath(
  userId: string,
  generationJobId: string,
): string {
  return `exports/users/${userId}/jobs/${generationJobId}/book.epub`;
}

function guessExtension(path: string): string {
  return path.toLowerCase().endsWith('.jpg') ||
    path.toLowerCase().endsWith('.jpeg')
    ? '.jpg'
    : '.png';
}

function guessMimeType(path: string): string {
  return guessExtension(path) === '.jpg' ? 'image/jpeg' : 'image/png';
}

/**
 * SPEC-031 — BullMQ execution boundary for exports.
 *
 * Lives next to the runner it invokes: the shared BullMqJobQueue is pinned
 * to the book queue and the book runner, so exports need their own queue
 * (`export-generation`) and worker with the same retry/backoff semantics.
 */
@Injectable()
export class ExportBullMqJobQueue
  implements JobQueue, OnModuleInit, OnModuleDestroy
{
  private queue?: Queue<ExportJobPayload>;
  private worker?: Worker<ExportJobPayload>;
  private workerConnection?: Redis;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly runner: ExportGenerationRunner,
    @Inject(JOB_REPOSITORY) private readonly jobs: JobRepository,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ExportBullMqJobQueue.name);
  }

  async onModuleInit(): Promise<void> {
    await assertRedisAvailable(this.redis);

    this.queue = new Queue<ExportJobPayload>(EXPORT_GENERATION_QUEUE, {
      connection: this.redis,
    });
    this.workerConnection = this.redis.duplicate();
    this.worker = new Worker<ExportJobPayload>(
      EXPORT_GENERATION_QUEUE,
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
        `Export job failed: ${error.message}`,
      );
    });
  }

  async enqueue(jobId: string, correlationId?: string): Promise<void> {
    if (!this.queue) {
      throw new Error('Export BullMQ queue is not initialized');
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

  private async process(job: Job<ExportJobPayload>): Promise<void> {
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
