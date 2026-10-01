import { Inject, Injectable } from '@nestjs/common';
import { toAiErrorDto } from '../common/errors/to-ai-error';
import { GenerationRunner } from '../ai/application/generation-runner';
import { JOB_REPOSITORY } from './job.repository';
import type { JobRepository } from './job.repository';
import type { JobQueue } from './job-queue.port';

@Injectable()
export class InlineJobQueue implements JobQueue {
  constructor(
    private readonly runner: GenerationRunner,
    @Inject(JOB_REPOSITORY) private readonly jobs: JobRepository,
  ) {}

  async enqueue(jobId: string): Promise<void> {
    try {
      await this.runner.run(jobId);
    } catch (error) {
      await this.jobs.fail(jobId, toAiErrorDto(error));
      throw error;
    }
  }
}
