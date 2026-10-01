import type { BookJobStatus } from '../ai/domain/book-generation.types';
import type { GenerateBookRequestDto } from '../ai/dto/generate-book-request.dto';
import type { GeneratedBookDto } from '../ai/dto/generated-book.dto';
import type { AiErrorDto } from '../common/dto/ai-error.dto';

export const JOB_REPOSITORY = Symbol('JOB_REPOSITORY');

export interface JobRecord {
  id: string;
  userId: string;
  profileId?: string;
  status: BookJobStatus;
  request: GenerateBookRequestDto;
  book?: GeneratedBookDto;
  error?: AiErrorDto;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: number;
}

export interface CreateJobInput {
  userId: string;
  profileId?: string;
  request: GenerateBookRequestDto;
}

export interface JobRepository {
  create(input: CreateJobInput): Promise<JobRecord>;
  markProcessing(jobId: string): Promise<void>;
  complete(jobId: string, book: GeneratedBookDto): Promise<void>;
  fail(jobId: string, error: AiErrorDto): Promise<void>;
  findById(jobId: string): Promise<JobRecord | undefined>;
  find(jobId: string, userId: string): Promise<JobRecord | undefined>;
}
