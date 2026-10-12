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
  // SPEC-033: per-response provider cost in USD (OpenRouter `usage.cost`).
  // Recorded via recordCost; absent until the runner reports one.
  costUsd?: number;
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
  // SPEC-033: persists the per-response provider cost in USD on the job
  // row (`generation_jobs.cost_usd`, migration 0010). Called by the
  // runners only when the provider reported a cost; failures record none.
  recordCost(jobId: string, costUsd: number): Promise<void>;
  findById(jobId: string): Promise<JobRecord | undefined>;
  find(jobId: string, userId: string): Promise<JobRecord | undefined>;
}
