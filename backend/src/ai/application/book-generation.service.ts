import { Inject, Injectable } from '@nestjs/common';
import { AiErrorException } from '../../common/errors/ai-error.exception';
import { JOB_QUEUE } from '../../jobs/job-queue.port';
import type { JobQueue } from '../../jobs/job-queue.port';
import { JOB_REPOSITORY } from '../../jobs/job.repository';
import type { JobRepository } from '../../jobs/job.repository';
import { BookOutputValidator } from './book-output.validator';
import type {
  BookGenerationCommand,
  BookGenerationUseCase,
} from './book-generation.use-case';
import { toJobStatusDto } from './job-status.mapper';
import {
  GenerateBookResponseDto,
  JobStatusDto,
} from '../dto/generate-book-response.dto';

@Injectable()
export class BookGenerationService implements BookGenerationUseCase {
  constructor(
    private readonly validator: BookOutputValidator,
    @Inject(JOB_REPOSITORY) private readonly jobs: JobRepository,
    @Inject(JOB_QUEUE) private readonly queue: JobQueue,
  ) {}

  async requestGeneration(
    command: BookGenerationCommand,
  ): Promise<GenerateBookResponseDto> {
    const audience = command.audience ?? 'child';
    this.validator.assertInputAllowed(command, audience);

    const job = await this.jobs.create({
      userId: command.userId,
      request: command,
    });

    await this.queue.enqueue(job.id, command.correlationId);

    const current = (await this.jobs.findById(job.id)) ?? job;

    return { jobId: job.id, status: current.status };
  }

  async getJobStatus(jobId: string, userId: string): Promise<JobStatusDto> {
    const job = await this.jobs.find(jobId, userId);

    if (!job) {
      throw new AiErrorException(404, 'NOT_FOUND', 'Job not found');
    }

    return toJobStatusDto(job);
  }
}
