import { Queue, Worker } from 'bullmq';
import type { Redis } from 'ioredis';
import { fakePinoLogger } from '../observability/fake-pino-logger';
import { AiProviderError } from '../ai/ai.errors';
import type { GenerationRunner } from '../ai/application/generation-runner';
import type { JobRepository } from './job.repository';
import {
  BullMqJobQueue,
  DEFAULT_JOB_ATTEMPTS,
  JOB_BACKOFF_MS,
} from './bullmq-job.queue';

jest.mock('bullmq', () => {
  const queue = {
    add: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  };
  const worker = {
    on: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
  };

  return {
    Queue: jest.fn(() => queue),
    Worker: jest.fn(() => worker),
  };
});

interface TestJob {
  data: { jobId: string };
  opts: { attempts?: number };
  attemptsMade: number;
}

function buildRedis() {
  const workerRedis = { quit: jest.fn().mockResolvedValue(undefined) };
  const ping = jest.fn().mockResolvedValue('PONG');
  const duplicate = jest.fn(() => workerRedis);
  const redis = {
    ping,
    duplicate,
    quit: jest.fn().mockResolvedValue(undefined),
  } as unknown as Redis;

  return { redis, workerRedis, ping, duplicate };
}

function buildQueue() {
  const { redis, workerRedis, ping, duplicate } = buildRedis();
  const run = jest.fn();
  const fail = jest.fn().mockResolvedValue(undefined);
  const runner = { run } as unknown as GenerationRunner;
  const jobs = { fail } as unknown as JobRepository;
  const queue = new BullMqJobQueue(redis, runner, jobs, fakePinoLogger());

  return { queue, redis, workerRedis, ping, duplicate, run, fail };
}

function lastQueueMock(): { add: jest.Mock; close: jest.Mock } {
  return (Queue as unknown as jest.Mock).mock.results.at(-1)?.value as {
    add: jest.Mock;
    close: jest.Mock;
  };
}

function lastWorkerMock(): { on: jest.Mock; close: jest.Mock } {
  return (Worker as unknown as jest.Mock).mock.results.at(-1)?.value as {
    on: jest.Mock;
    close: jest.Mock;
  };
}

function lastProcessor(): (job: TestJob) => Promise<void> {
  const calls = (Worker as unknown as jest.Mock).mock.calls as unknown as
    unknown[][] | undefined;
  const lastCall = calls?.at(-1) ?? [];

  return lastCall[1] as (job: TestJob) => Promise<void>;
}

describe('BullMqJobQueue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initializes the queue and worker after pinging Redis', async () => {
    const { queue, ping, duplicate } = buildQueue();

    await queue.onModuleInit();

    expect(ping).toHaveBeenCalled();
    expect(duplicate).toHaveBeenCalled();
    expect(Queue).toHaveBeenCalledTimes(1);
    expect(Worker).toHaveBeenCalledTimes(1);
    expect(lastWorkerMock().on).toHaveBeenCalledWith(
      'failed',
      expect.any(Function),
    );

    await queue.onModuleDestroy();
  });

  it('enqueues with retries and exponential backoff', async () => {
    const { queue } = buildQueue();
    await queue.onModuleInit();

    await queue.enqueue('job-1');

    expect(lastQueueMock().add).toHaveBeenCalledWith(
      'generate',
      { jobId: 'job-1' },
      expect.objectContaining({
        jobId: 'job-1',
        attempts: DEFAULT_JOB_ATTEMPTS,
        backoff: { type: 'exponential', delay: JOB_BACKOFF_MS },
      }),
    );
  });

  it('rejects enqueue before initialization', async () => {
    const { queue } = buildQueue();

    await expect(queue.enqueue('job-1')).rejects.toThrow(
      'BullMQ queue is not initialized',
    );
  });

  it('runs the generation through the worker processor', async () => {
    const { queue, run } = buildQueue();
    await queue.onModuleInit();

    await lastProcessor()({
      data: { jobId: 'job-1' },
      opts: { attempts: DEFAULT_JOB_ATTEMPTS },
      attemptsMade: 0,
    });

    expect(run).toHaveBeenCalledWith('job-1', undefined);
  });

  it('carries the correlation id from payload to runner (SPEC-027)', async () => {
    const { queue, run } = buildQueue();
    await queue.onModuleInit();

    await queue.enqueue('job-1', 'corr-1');

    expect(lastQueueMock().add).toHaveBeenCalledWith(
      'generate',
      { jobId: 'job-1', correlationId: 'corr-1' },
      expect.anything(),
    );

    await lastProcessor()({
      data: { jobId: 'job-1', correlationId: 'corr-1' },
      opts: { attempts: DEFAULT_JOB_ATTEMPTS },
      attemptsMade: 0,
    });

    expect(run).toHaveBeenCalledWith('job-1', 'corr-1');
  });

  it('keeps the job pending on a transient failure', async () => {
    const error = new AiProviderError('PROVIDER_UNAVAILABLE', 'down');
    const { queue, run, fail } = buildQueue();
    run.mockRejectedValue(error);
    await queue.onModuleInit();

    await expect(
      lastProcessor()({
        data: { jobId: 'job-1' },
        opts: { attempts: DEFAULT_JOB_ATTEMPTS },
        attemptsMade: 0,
      }),
    ).rejects.toBe(error);
    expect(fail).not.toHaveBeenCalled();
  });

  it('marks the job failed after the final attempt', async () => {
    const error = new AiProviderError('RATE_LIMITED', 'quota');
    const { queue, run, fail } = buildQueue();
    run.mockRejectedValue(error);
    await queue.onModuleInit();

    await expect(
      lastProcessor()({
        data: { jobId: 'job-1' },
        opts: { attempts: DEFAULT_JOB_ATTEMPTS },
        attemptsMade: DEFAULT_JOB_ATTEMPTS - 1,
      }),
    ).rejects.toBe(error);
    expect(fail).toHaveBeenCalledWith(
      'job-1',
      expect.objectContaining({ code: 'RATE_LIMITED' }),
    );
  });

  it('closes workers and connections on destroy', async () => {
    const { queue, workerRedis } = buildQueue();
    await queue.onModuleInit();
    const workerClose = lastWorkerMock().close;

    await queue.onModuleDestroy();

    expect(workerClose).toHaveBeenCalled();
    expect(lastQueueMock().close).toHaveBeenCalled();
    expect(workerRedis.quit).toHaveBeenCalled();
  });
});
