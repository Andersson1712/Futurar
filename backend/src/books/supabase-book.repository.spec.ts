import type { SupabaseClient } from '@supabase/supabase-js';
import { AiErrorException } from '../common/errors/ai-error.exception';
import type { SupabaseService } from '../supabase/supabase.service';
import type { BookAudit, BookSnapshot } from './book.repository';
import { SupabaseBookRepository } from './supabase-book.repository';

interface MockQuery {
  [key: string]: jest.Mock;
}

interface QueryResults {
  single?: unknown;
  maybeSingle?: unknown;
  terminal?: unknown;
}

const EMPTY = { data: null, error: null };

function createQuery(results: QueryResults = {}): MockQuery {
  const query: MockQuery = {};
  const chain = () => query;

  query.select = jest.fn(chain);
  query.insert = jest.fn(chain);
  query.update = jest.fn(chain);
  query.eq = jest.fn(chain);
  query.is = jest.fn(chain);
  query.order = jest.fn(chain);
  query.limit = jest.fn(chain);
  query.single = jest.fn(() => Promise.resolve(results.single ?? EMPTY));
  query.maybeSingle = jest.fn(() =>
    Promise.resolve(results.maybeSingle ?? results.single ?? EMPTY),
  );
  query.then = jest.fn((resolve: (value: unknown) => unknown) =>
    Promise.resolve(results.terminal ?? EMPTY).then(resolve),
  );

  return query;
}

const BOOK_ROW = {
  id: 'book-1',
  user_id: 'user-1',
  profile_id: null,
  title: 'La aventura del dragón',
  page_count: 1,
  current_version: 1,
  deleted_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const VERSION_ROW = {
  book_id: 'book-1',
  version: 1,
  title: 'La aventura del dragón',
  dedication: 'Para Ana',
  pages: [
    {
      pageNumber: 1,
      content: 'Había una vez',
      imagePath: 'users/user-1/jobs/job-1/page-1.png',
    },
  ],
  prompt_version: 'book/v1',
  model: 'gemini-test',
  input_tokens: 10,
  output_tokens: 20,
  image_count: 1,
  generation_job_id: 'job-1',
  created_by: 'user-1',
  created_at: '2026-01-01T00:00:00.000Z',
};

const SNAPSHOT: BookSnapshot = {
  title: 'La aventura del dragón',
  dedication: 'Para Ana',
  pages: [{ pageNumber: 1, content: 'Había una vez' }],
};

const AUDIT: BookAudit = {
  promptVersion: 'book/v1',
  model: 'gemini-test',
  inputTokens: 10,
  outputTokens: 20,
  imageCount: 0,
  generationJobId: 'job-1',
  createdBy: 'user-1',
};

function buildRepository(
  options: {
    booksResults?: QueryResults;
    versionsResults?: QueryResults;
    hasClient?: boolean;
  } = {},
) {
  const books = createQuery(options.booksResults);
  const versions = createQuery(options.versionsResults);
  const from = jest.fn((table: string) =>
    table === 'books' ? books : versions,
  );
  const client = { from } as unknown as SupabaseClient;
  const supabaseService = {
    getClient: () => (options.hasClient === false ? null : client),
  } as unknown as SupabaseService;

  return {
    repository: new SupabaseBookRepository(supabaseService),
    books,
    versions,
    from,
  };
}

describe('SupabaseBookRepository', () => {
  it('saves the book and its first version with audit fields', async () => {
    const { repository, books, versions } = buildRepository({
      booksResults: { single: { data: BOOK_ROW, error: null } },
      versionsResults: {
        maybeSingle: EMPTY,
        single: { data: VERSION_ROW, error: null },
      },
    });

    const book = await repository.save({
      userId: 'user-1',
      snapshot: SNAPSHOT,
      audit: AUDIT,
    });

    expect(books.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        title: 'La aventura del dragón',
        page_count: 1,
        current_version: 1,
      }),
    );
    expect(versions.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        book_id: 'book-1',
        version: 1,
        prompt_version: 'book/v1',
        model: 'gemini-test',
        image_count: 0,
        generation_job_id: 'job-1',
        created_by: 'user-1',
      }),
    );
    expect(book).toMatchObject({
      id: 'book-1',
      currentVersion: 1,
      title: 'La aventura del dragón',
    });
    expect(book.version.audit.generationJobId).toBe('job-1');
  });

  it('is idempotent by generation job id', async () => {
    const { repository, books, versions } = buildRepository({
      booksResults: { maybeSingle: { data: BOOK_ROW, error: null } },
      versionsResults: { maybeSingle: { data: VERSION_ROW, error: null } },
    });

    const book = await repository.save({
      userId: 'user-1',
      snapshot: SNAPSHOT,
      audit: AUDIT,
    });

    expect(book.id).toBe('book-1');
    expect(books.insert).not.toHaveBeenCalled();
    expect(versions.insert).not.toHaveBeenCalled();
  });

  it('loads a book with its current version', async () => {
    const { repository } = buildRepository({
      booksResults: { maybeSingle: { data: BOOK_ROW, error: null } },
      versionsResults: { maybeSingle: { data: VERSION_ROW, error: null } },
    });

    const book = await repository.findById('book-1', 'user-1');

    expect(book?.version.pages).toHaveLength(1);
    expect(book?.version.dedication).toBe('Para Ana');
  });

  it('returns undefined for missing or deleted books', async () => {
    const { repository } = buildRepository({
      booksResults: { maybeSingle: EMPTY },
    });

    await expect(
      repository.findById('missing', 'user-1'),
    ).resolves.toBeUndefined();
  });

  it('lists book summaries', async () => {
    const { repository } = buildRepository({
      booksResults: { terminal: { data: [BOOK_ROW], error: null } },
    });

    const books = await repository.listByUser('user-1');

    expect(books).toHaveLength(1);
    expect(books[0]).toMatchObject({
      id: 'book-1',
      pageCount: 1,
      currentVersion: 1,
    });
  });

  it('soft-deletes by updating deleted_at', async () => {
    const { repository, books } = buildRepository({
      booksResults: { terminal: { data: [BOOK_ROW], error: null } },
    });

    await expect(repository.softDelete('book-1', 'user-1')).resolves.toBe(true);

    const calls = books.update.mock.calls as unknown as Array<
      [Record<string, unknown>]
    >;
    expect(typeof calls[0][0].deleted_at).toBe('string');
  });

  it('returns false when nothing was soft-deleted', async () => {
    const { repository } = buildRepository({
      booksResults: { terminal: { data: [], error: null } },
    });

    await expect(repository.softDelete('book-1', 'user-1')).resolves.toBe(
      false,
    );
  });

  it('fails with 503 when Supabase is not configured', async () => {
    const { repository } = buildRepository({ hasClient: false });

    const error = await repository
      .save({ userId: 'user-1', snapshot: SNAPSHOT, audit: AUDIT })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AiErrorException);
    expect((error as AiErrorException).getStatus()).toBe(503);
  });
});
