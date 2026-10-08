import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiErrorException } from '../../common/errors/ai-error.exception';
import { EXPORT_JOB_QUEUE } from './export-generation.use-case';
import type { JobQueue } from '../../jobs/job-queue.port';
import { JOB_REPOSITORY } from '../../jobs/job.repository';
import type { JobRepository } from '../../jobs/job.repository';
import { GenerateBookRequestDto } from '../dto/generate-book-request.dto';
import { isExportFlagEnabled } from '../domain/export-generation.types';
import type {
  ExportGenerationCommand,
  ExportGenerationUseCase,
} from './export-generation.use-case';
import { toJobStatusDto } from './job-status.mapper';
import {
  GenerateBookResponseDto,
  JobStatusDto,
} from '../dto/generate-book-response.dto';
import { BOOK_REPOSITORY } from '../../books/book.repository';
import type { BookRepository } from '../../books/book.repository';

@Injectable()
export class ExportGenerationService implements ExportGenerationUseCase {
  constructor(
    private readonly configService: ConfigService,
    @Inject(JOB_REPOSITORY) private readonly jobs: JobRepository,
    @Inject(BOOK_REPOSITORY) private readonly books: BookRepository,
    @Inject(EXPORT_JOB_QUEUE) private readonly queue: JobQueue,
  ) {}

  async requestExport(
    command: ExportGenerationCommand,
  ): Promise<GenerateBookResponseDto> {
    if (
      !isExportFlagEnabled(this.configService.get<boolean>('EXPORTS_ENABLED'))
    ) {
      throw new AiErrorException(
        501,
        'NOT_IMPLEMENTED',
        'Export endpoints are disabled',
      );
    }

    const format = command.format as string;

    if (format !== 'epub') {
      throw new AiErrorException(
        501,
        'NOT_IMPLEMENTED',
        `Export format '${format}' is not supported yet`,
      );
    }

    const book = await this.books.findById(command.bookId, command.userId);

    if (!book) {
      throw new AiErrorException(404, 'NOT_FOUND', 'Book not found');
    }

    // Jobs stay vertical-agnostic (SPEC-031): the export brief rides the
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
