import { BookAudit, BookSnapshot } from './book.repository';
import { InMemoryBookRepository } from './in-memory-book.repository';

const SNAPSHOT: BookSnapshot = {
  title: 'La aventura del dragón',
  dedication: 'Para Ana',
  pages: [
    {
      pageNumber: 1,
      content: 'Había una vez',
      imagePath: 'users/user-1/jobs/job-1/page-1.png',
    },
  ],
};

function buildAudit(overrides: Partial<BookAudit> = {}): BookAudit {
  return {
    promptVersion: 'book/v1',
    model: 'gemini-test',
    inputTokens: 10,
    outputTokens: 20,
    imageCount: 1,
    generationJobId: 'job-1',
    createdBy: 'user-1',
    ...overrides,
  };
}

describe('InMemoryBookRepository', () => {
  it('saves a book with version 1 and audit data', async () => {
    const repository = new InMemoryBookRepository();

    const book = await repository.save({
      userId: 'user-1',
      snapshot: SNAPSHOT,
      audit: buildAudit(),
    });

    expect(book.id).toBeDefined();
    expect(book.currentVersion).toBe(1);
    expect(book.title).toBe('La aventura del dragón');
    expect(book.pageCount).toBe(1);
    expect(book.version.audit.promptVersion).toBe('book/v1');
  });

  it('is idempotent by generation job id', async () => {
    const repository = new InMemoryBookRepository();
    const first = await repository.save({
      userId: 'user-1',
      snapshot: SNAPSHOT,
      audit: buildAudit(),
    });

    const second = await repository.save({
      userId: 'user-1',
      snapshot: { ...SNAPSHOT, title: 'Otro título' },
      audit: buildAudit(),
    });

    expect(second.id).toBe(first.id);
    expect(second.title).toBe('La aventura del dragón');
  });

  it('finds books scoped by user and hides deleted ones', async () => {
    const repository = new InMemoryBookRepository();
    const book = await repository.save({
      userId: 'user-1',
      snapshot: SNAPSHOT,
      audit: buildAudit({ generationJobId: undefined }),
    });

    await expect(repository.findById(book.id, 'user-1')).resolves.toMatchObject(
      { id: book.id },
    );
    await expect(
      repository.findById(book.id, 'user-2'),
    ).resolves.toBeUndefined();

    await expect(repository.softDelete(book.id, 'user-1')).resolves.toBe(true);
    await expect(
      repository.findById(book.id, 'user-1'),
    ).resolves.toBeUndefined();
  });

  it('lists owned books without deleted ones, newest first', async () => {
    const repository = new InMemoryBookRepository();
    const first = await repository.save({
      userId: 'user-1',
      snapshot: SNAPSHOT,
      audit: buildAudit({ generationJobId: 'job-1' }),
    });
    await repository.save({
      userId: 'user-2',
      snapshot: SNAPSHOT,
      audit: buildAudit({ generationJobId: 'job-2', createdBy: 'user-2' }),
    });
    await repository.softDelete(first.id, 'user-1');

    await expect(repository.listByUser('user-1')).resolves.toEqual([]);
  });

  it('filters by profile when provided', async () => {
    const repository = new InMemoryBookRepository();
    const first = await repository.save({
      userId: 'user-1',
      profileId: 'student-1',
      snapshot: SNAPSHOT,
      audit: buildAudit({ generationJobId: undefined }),
    });
    await repository.save({
      userId: 'user-1',
      profileId: 'student-2',
      snapshot: SNAPSHOT,
      audit: buildAudit({ generationJobId: undefined }),
    });

    await expect(repository.listByUser('user-1', 'student-1')).resolves.toEqual(
      [expect.objectContaining({ id: first.id })],
    );
    await expect(repository.listByUser('user-1')).resolves.toHaveLength(2);
  });

  it('rejects soft deletes for foreign, missing or deleted books', async () => {
    const repository = new InMemoryBookRepository();
    const book = await repository.save({
      userId: 'user-1',
      snapshot: SNAPSHOT,
      audit: buildAudit({ generationJobId: undefined }),
    });

    await expect(repository.softDelete(book.id, 'user-2')).resolves.toBe(false);
    await expect(repository.softDelete('missing', 'user-1')).resolves.toBe(
      false,
    );
    await expect(repository.softDelete(book.id, 'user-1')).resolves.toBe(true);
    await expect(repository.softDelete(book.id, 'user-1')).resolves.toBe(false);
  });
});
