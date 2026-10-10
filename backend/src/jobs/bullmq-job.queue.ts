import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Job, Queue, Worker } from 'bullmq';
import type { Redis } from 'ioredis';
import { PinoLogger } from 'nestjs-pino';
import { GenerationRunner } from '../ai/application/generation-runner';
import { toAiErrorDto } from '../common/errors/to-ai-error';
import {
  assertRedisAvailable,
  REDIS_CLIENT,
} from '../common/redis/redis-client';
import { JOB_REPOSITORY } from './job.repository';
import type { JobRepository } from './job.repository';
import { BOOK_GENERATION_QUEUE, BookJobPayload } from './job-queue.port';
import type { JobQueue } from './job-queue.port';

export const DEFAULT_JOB_ATTEMPTS = 3;
export const JOB_BACKOFF_MS = 5_000;
export const WORKER_CONCURRENCY = 1;

@Injectable()
export class BullMqJobQueue implements JobQueue, OnModuleInit, OnModuleDestroy {
  private queue?: Queue<BookJobPayload>;
  private worker?: Worker<BookJobPayload>;
  private workerConnection?: Redis;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly runner: GenerationRunner,
    @Inject(JOB_REPOSITORY) private readonly jobs: JobRepository,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(BullMqJobQueue.name);
  }

  async onModuleInit(): Promise<void> {
    await assertRedisAvailable(this.redis);

    this.queue = new Queue<BookJobPayload>(BOOK_GENERATION_QUEUE, {
      connection: this.redis,
    });
    this.workerConnection = this.redis.duplicate();
    this.worker = new Worker<BookJobPayload>(
      BOOK_GENERATION_QUEUE,
      (job) => this.process(job),
      {
        connection: this.workerConnection,
        concurrency: WORKER_CONCURRENCY,
      },
    );
    this.worker.on('failed', (job, error) => {
      this.logger.warn(
        {
          jobId: job?.data.jobId ?? 'unknown',
          correlationId: job?.data.correlationId,
        },
        `Generation job failed: ${error.message}`,
      );
    });
  }

  async enqueue(jobId: string, correlationId?: string): Promise<void> {
    const queue = this.requireQueue();

    await queue.add(
      'generate',
      { jobId, ...(correlationId ? { correlationId } : {}) },
      {
        jobId,
        attempts: DEFAULT_JOB_ATTEMPTS,
        backoff: { type: 'exponential', delay: JOB_BACKOFF_MS },
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

  private async process(job: Job<BookJobPayload>): Promise<void> {
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

  private requireQueue(): Queue<BookJobPayload> {
    if (!this.queue) {
      throw new Error('BullMQ queue is not initialized');
    }

    return this.queue;
  }
}
