import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiErrorException } from '../../common/errors/ai-error.exception';
import { DESIGN_JOB_QUEUE } from './design-generation.use-case';
import type { JobQueue } from '../../jobs/job-queue.port';
import { JOB_REPOSITORY } from '../../jobs/job.repository';
import type { JobRepository } from '../../jobs/job.repository';
import { GenerateBookRequestDto } from '../dto/generate-book-request.dto';
import { isDesignFlagEnabled } from '../domain/design-generation.types';
import { DesignOutputValidator } from './design-output.validator';
import type {
  DesignGenerationCommand,
  DesignGenerationUseCase,
} from './design-generation.use-case';
import { toJobStatusDto } from './job-status.mapper';
import {
  GenerateBookResponseDto,
  JobStatusDto,
} from '../dto/generate-book-response.dto';

@Injectable()
export class DesignGenerationService implements DesignGenerationUseCase {
  constructor(
    private readonly validator: DesignOutputValidator,
    private readonly configService: ConfigService,
    @Inject(JOB_REPOSITORY) private readonly jobs: JobRepository,
    @Inject(DESIGN_JOB_QUEUE) private readonly queue: JobQueue,
  ) {}

  async requestGeneration(
    command: DesignGenerationCommand,
  ): Promise<GenerateBookResponseDto> {
    if (
      !isDesignFlagEnabled(
        this.configService.get<boolean>('DESIGN_ENDPOINTS_ENABLED'),
      )
    ) {
      throw new AiErrorException(
        501,
        'NOT_IMPLEMENTED',
        'Design endpoints are disabled',
      );
    }

    const audience = command.audience ?? 'child';
    this.validator.assertInputAllowed(command, audience);

    // Jobs stay vertical-agnostic (SPEC-029): the design brief rides the
    // generic job request envelope untouched.
    const job = await this.jobs.create({
      userId: command.userId,
      request: command as unknown as GenerateBookRequestDto,
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
