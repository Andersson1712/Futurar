import type { SupabaseClient } from '@supabase/supabase-js';
import { AiErrorException } from '../common/errors/ai-error.exception';
import type { SupabaseService } from '../supabase/supabase.service';
import {
  BookRepository,
  SaveBookInput,
  StoredBook,
  StoredBookSummary,
  StoredBookVersion,
  StoredPage,
} from './book.repository';

export const BOOKS_TABLE = 'books';
export const BOOK_VERSIONS_TABLE = 'book_versions';

interface BookRow {
  id: string;
  user_id: string;
  profile_id: string | null;
  title: string;
  page_count: number;
  current_version: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

interface BookVersionRow {
  book_id: string;
  version: number;
  title: string;
  dedication: string | null;
  story_config: unknown;
  pages: unknown;
  prompt_version: string;
  model: string;
  input_tokens: number | null;
  output_tokens: number | null;
  image_count: number;
  generation_job_id: string | null;
  created_by: string;
  created_at: string;
}

interface RowResponse<T> {
  data: T | null;
  error: unknown;
}

type BooksClient = SupabaseClient;

export class SupabaseBookRepository implements BookRepository {
  constructor(private readonly supabaseService: SupabaseService) {}

  async save(input: SaveBookInput): Promise<StoredBook> {
    const jobId = input.audit.generationJobId;

    if (jobId) {
      const existing = await this.findByGenerationJob(jobId);

      if (existing) return existing;
    }

    const client = this.requireClient();
    const bookResponse = (await client
      .from(BOOKS_TABLE)
      .insert({
        user_id: input.userId,
        profile_id: input.profileId ?? null,
        title: input.snapshot.title,
        page_count: input.snapshot.pages.length,
        current_version: 1,
      })
      .select()
      .single()) as unknown as RowResponse<BookRow>;

    if (bookResponse.error || !bookResponse.data) {
      throw persistenceUnavailable();
    }

    const versionResponse = (await client
      .from(BOOK_VERSIONS_TABLE)
      .insert({
        book_id: bookResponse.data.id,
        version: 1,
        title: input.snapshot.title,
        dedication: input.snapshot.dedication ?? null,
        story_config: input.snapshot.config ?? {},
        pages: input.snapshot.pages,
        prompt_version: input.audit.promptVersion,
        model: input.audit.model,
        input_tokens: input.audit.inputTokens ?? null,
        output_tokens: input.audit.outputTokens ?? null,
        image_count: input.audit.imageCount,
        generation_job_id: input.audit.generationJobId ?? null,
        created_by: input.audit.createdBy,
      })
      .select()
      .single()) as unknown as RowResponse<BookVersionRow>;

    if (versionResponse.error || !versionResponse.data) {
      throw persistenceUnavailable();
    }

    return assemble(bookResponse.data, versionResponse.data);
  }

  async findById(
    bookId: string,
    userId: string,
  ): Promise<StoredBook | undefined> {
    const client = this.requireClient();
    const bookResponse = (await client
      .from(BOOKS_TABLE)
      .select()
      .eq('id', bookId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .maybeSingle()) as unknown as RowResponse<BookRow>;

    if (bookResponse.error || !bookResponse.data) return undefined;

    const version = await this.findVersion(client, bookResponse.data);
    if (!version) return undefined;

    return assemble(bookResponse.data, version);
  }

  async listByUser(
    userId: string,
    profileId?: string,
  ): Promise<StoredBookSummary[]> {
    const client = this.requireClient();
    let query = client
      .from(BOOKS_TABLE)
      .select()
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (profileId) {
      query = query.eq('profile_id', profileId);
    }

    const response = (await query
      .order('created_at', { ascending: false })
      .limit(100)) as unknown as RowResponse<BookRow[]>;

    if (response.error || !response.data) return [];

    return response.data.map(toSummary);
  }

  async softDelete(bookId: string, userId: string): Promise<boolean> {
    const client = this.requireClient();
    const response = (await client
      .from(BOOKS_TABLE)
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', bookId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .select()) as unknown as RowResponse<BookRow[]>;

    if (response.error) {
      throw persistenceUnavailable();
    }

    return (response.data?.length ?? 0) > 0;
  }

  private async findByGenerationJob(
    jobId: string,
  ): Promise<StoredBook | undefined> {
    const client = this.requireClient();
    const versionResponse = (await client
      .from(BOOK_VERSIONS_TABLE)
      .select()
      .eq('generation_job_id', jobId)
      .maybeSingle()) as unknown as RowResponse<BookVersionRow>;

    if (versionResponse.error || !versionResponse.data) return undefined;

    const bookResponse = (await client
      .from(BOOKS_TABLE)
      .select()
      .eq('id', versionResponse.data.book_id)
      .maybeSingle()) as unknown as RowResponse<BookRow>;

    if (bookResponse.error || !bookResponse.data) return undefined;

    return assemble(bookResponse.data, versionResponse.data);
  }

  private async findVersion(
    client: BooksClient,
    book: BookRow,
  ): Promise<BookVersionRow | undefined> {
    const response = (await client
      .from(BOOK_VERSIONS_TABLE)
      .select()
      .eq('book_id', book.id)
      .eq('version', book.current_version)
      .maybeSingle()) as unknown as RowResponse<BookVersionRow>;

    if (response.error || !response.data) return undefined;

    return response.data;
  }

  private requireClient(): BooksClient {
    const client = this.supabaseService.getClient();

    if (!client) {
      throw new AiErrorException(
        503,
        'PROVIDER_UNAVAILABLE',
        'Book persistence is not configured',
      );
    }

    return client;
  }
}

function assemble(book: BookRow, version: BookVersionRow): StoredBook {
  return {
    ...toSummary(book),
    version: toVersion(version),
  };
}

function toSummary(row: BookRow): StoredBookSummary {
  return {
    id: row.id,
    userId: row.user_id,
    profileId: row.profile_id ?? undefined,
    title: row.title,
    pageCount: row.page_count,
    currentVersion: row.current_version,
    deletedAt: row.deleted_at ? new Date(row.deleted_at) : undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function toVersion(row: BookVersionRow): StoredBookVersion {
  return {
    version: row.version,
    title: row.title,
    dedication: row.dedication ?? undefined,
    config: (row.story_config as StoredBookVersion['config']) ?? undefined,
    pages: (row.pages as StoredPage[]) ?? [],
    audit: {
      promptVersion: row.prompt_version,
      model: row.model,
      inputTokens: row.input_tokens ?? undefined,
      outputTokens: row.output_tokens ?? undefined,
      imageCount: row.image_count,
      generationJobId: row.generation_job_id ?? undefined,
      createdBy: row.created_by,
    },
    createdAt: new Date(row.created_at),
  };
}

function persistenceUnavailable(): AiErrorException {
  return new AiErrorException(
    503,
    'PROVIDER_UNAVAILABLE',
    'Book persistence is unavailable',
  );
}
