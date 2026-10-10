import type { SupabaseClient } from '@supabase/supabase-js';
import { AiErrorException } from '../common/errors/ai-error.exception';
import type { AiErrorDto } from '../common/dto/ai-error.dto';
import type { BookJobStatus } from '../ai/domain/book-generation.types';
import type { GenerateBookRequestDto } from '../ai/dto/generate-book-request.dto';
import type { GeneratedBookDto } from '../ai/dto/generated-book.dto';
import type { SupabaseService } from '../supabase/supabase.service';
import { CreateJobInput, JobRecord, JobRepository } from './job.repository';

export const GENERATION_JOBS_TABLE = 'generation_jobs';

interface GenerationJobRow {
  id: string;
  user_id: string;
  profile_id: string | null;
  status: string;
  request: unknown;
  book: unknown;
  error: unknown;
  // SPEC-033: `cost_usd` (migration 0010). Optional on read so rows from
  // before the migration still map; writes require the migrated column.
  cost_usd?: number | null;
  created_at: string;
  updated_at: string;
}

interface RowResponse<T> {
  data: T | null;
  error: unknown;
}

interface ErrorResponse {
  error: unknown;
}

export class SupabaseJobRepository implements JobRepository {
  constructor(private readonly supabaseService: SupabaseService) {}

  async create(input: CreateJobInput): Promise<JobRecord> {
    const response = (await this.requireClient()
      .from(GENERATION_JOBS_TABLE)
      .insert({
        user_id: input.userId,
        profile_id: input.profileId ?? null,
        status: 'queued',
        request: input.request,
      })
      .select()
      .single()) as unknown as RowResponse<GenerationJobRow>;

    if (response.error || !response.data) {
      throw persistenceUnavailable();
    }

    return mapRow(response.data);
  }

  async markProcessing(jobId: string): Promise<void> {
    await this.update(jobId, { status: 'processing' });
  }

  async complete(jobId: string, book: GeneratedBookDto): Promise<void> {
    await this.update(jobId, { status: 'completed', book, error: null });
  }

  async fail(jobId: string, error: AiErrorDto): Promise<void> {
    await this.update(jobId, { status: 'failed', error });
  }

  async recordCost(jobId: string, costUsd: number): Promise<void> {
    await this.update(jobId, { cost_usd: costUsd });
  }

  async findById(jobId: string): Promise<JobRecord | undefined> {
    const response = (await this.requireClient()
      .from(GENERATION_JOBS_TABLE)
      .select()
      .eq('id', jobId)
      .maybeSingle()) as unknown as RowResponse<GenerationJobRow>;

    if (response.error || !response.data) return undefined;

    return mapRow(response.data);
  }

  async find(jobId: string, userId: string): Promise<JobRecord | undefined> {
    const response = (await this.requireClient()
      .from(GENERATION_JOBS_TABLE)
      .select()
      .eq('id', jobId)
      .eq('user_id', userId)
      .maybeSingle()) as unknown as RowResponse<GenerationJobRow>;

    if (response.error || !response.data) return undefined;

    return mapRow(response.data);
  }

  private async update(
    jobId: string,
    values: Record<string, unknown>,
  ): Promise<void> {
    const response = (await this.requireClient()
      .from(GENERATION_JOBS_TABLE)
      .update({ ...values, updated_at: new Date().toISOString() })
      .eq('id', jobId)) as unknown as ErrorResponse;

    if (response.error) {
      throw persistenceUnavailable();
    }
  }

  private requireClient(): SupabaseClient {
    const client = this.supabaseService.getClient();

    if (!client) {
      throw new AiErrorException(
        503,
        'PROVIDER_UNAVAILABLE',
        'Job persistence is not configured',
      );
    }

    return client;
  }
}

function mapRow(row: GenerationJobRow): JobRecord {
  return {
    id: row.id,
    userId: row.user_id,
    profileId: row.profile_id ?? undefined,
    status: row.status as BookJobStatus,
    request: row.request as GenerateBookRequestDto,
    book: (row.book as GeneratedBookDto | null) ?? undefined,
    error: (row.error as AiErrorDto | null) ?? undefined,
    costUsd: row.cost_usd ?? undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function persistenceUnavailable(): AiErrorException {
  return new AiErrorException(
    503,
    'PROVIDER_UNAVAILABLE',
    'Job persistence is unavailable',
  );
}
