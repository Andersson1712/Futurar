import { ConfigService } from '@nestjs/config';
import { AiErrorException } from '../common/errors/ai-error.exception';
import {
  BookRepository,
  StoredBook,
  StoredBookSummary,
} from './book.repository';
import { BookStorage } from './book-storage.port';
import { BooksService } from './books.service';

function buildSummary(
  overrides: Partial<StoredBookSummary> = {},
): StoredBookSummary {
  return {
    id: 'book-1',
    userId: 'user-1',
    title: 'La aventura del dragón',
    pageCount: 2,
    currentVersion: 1,
    isFavorite: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function buildBook(overrides: Partial<StoredBook> = {}): StoredBook {
  return {
    ...buildSummary(),
    version: {
      version: 1,
      title: 'La aventura del dragón',
      dedication: 'Para Ana',
      pages: [
        {
          pageNumber: 1,
          content: 'Había una vez',
          imagePath: 'users/user-1/jobs/job-1/page-1.png',
        },
        { pageNumber: 2, content: 'Y fueron felices' },
      ],
      audit: {
        promptVersion: 'book/v1',
        model: 'gemini-test',
        imageCount: 1,
        createdBy: 'user-1',
      },
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    },
    dedication: {
      to: 'Ana',
      reason: 'por su cumpleaños',
      position: 'start',
    },
    ...overrides,
  };
}

function buildService(
  options: {
    books?: Partial<BookRepository>;
    ttl?: number;
    signedUrlError?: boolean;
  } = {},
) {
  const signedUrl = jest
    .fn()
    .mockImplementation((path: string) =>
      options.signedUrlError
        ? Promise.reject(
            new AiErrorException(503, 'PROVIDER_UNAVAILABLE', 'down'),
          )
        : Promise.resolve(`https://signed.example/${path}`),
    );
  const books: BookRepository = {
    save: jest.fn(),
    findById: jest.fn().mockResolvedValue(buildBook()),
    listByUser: jest.fn().mockResolvedValue([buildSummary()]),
    softDelete: jest.fn().mockResolvedValue(true),
    saveDedication: jest.fn(),
    setFavorite: jest.fn(),
    ...options.books,
  };
  const storage = { upload: jest.fn(), signedUrl } as unknown as BookStorage;
  const configService = new ConfigService(
    options.ttl === undefined
      ? {}
      : { BOOK_IMAGE_SIGNED_URL_TTL_SECONDS: options.ttl },
  );
  const service = new BooksService(books, storage, configService);

  return { service, books, storage, signedUrl };
}

describe('BooksService', () => {
  it('lists book summaries', async () => {
    const { service } = buildService();

    const books = await service.list('user-1');

    expect(books).toEqual([
      expect.objectContaining({
        id: 'book-1',
        pageCount: 2,
        version: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
    ]);
  });

  it('returns book details with fresh signed URLs only for image pages', async () => {
    const { service, signedUrl } = buildService({ ttl: 120 });

    const book = await service.get('book-1', 'user-1');

    expect(book.pages[0]).toMatchObject({
      pageNumber: 1,
      imageUrl: 'https://signed.example/users/user-1/jobs/job-1/page-1.png',
    });
    expect(book.pages[1].imageUrl).toBeUndefined();
    expect(signedUrl).toHaveBeenCalledTimes(1);
    expect(signedUrl).toHaveBeenCalledWith(
      'users/user-1/jobs/job-1/page-1.png',
      120,
    );
    expect(book.dedicationTo).toBe('Ana');
    expect(book.dedicationReason).toBe('por su cumpleaños');
    expect(book.dedicationPosition).toBe('start');
  });

  it('uses the default TTL when not configured', async () => {
    const { service, signedUrl } = buildService();

    await service.get('book-1', 'user-1');

    expect(signedUrl).toHaveBeenCalledWith(expect.any(String), 3600);
  });

  it('returns 404 for unknown books', async () => {
    const { service } = buildService({
      books: { findById: jest.fn().mockResolvedValue(undefined) },
    });

    await expect(service.get('missing', 'user-1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('soft deletes owned books and 404 otherwise', async () => {
    const { service } = buildService();

    await expect(service.remove('book-1', 'user-1')).resolves.toBeUndefined();

    const notFound = buildService({
      books: { softDelete: jest.fn().mockResolvedValue(false) },
    });
    await expect(
      notFound.service.remove('missing', 'user-1'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('propagates storage failures when signing images', async () => {
    const { service } = buildService({ signedUrlError: true });

    await expect(service.get('book-1', 'user-1')).rejects.toBeInstanceOf(
      AiErrorException,
    );
  });

  it('saves and clears the dedication of a book', async () => {
    const saveDedication = jest
      .fn()
      .mockResolvedValue(
        buildBook({ dedication: { to: 'Beto', position: 'end' } }),
      );
    const { service } = buildService({ books: { saveDedication } });

    const saved = await service.saveDedication('book-1', 'user-1', {
      to: 'Beto',
      position: 'end',
    });

    expect(saveDedication).toHaveBeenCalledWith('book-1', 'user-1', {
      to: 'Beto',
      reason: undefined,
      position: 'end',
    });
    expect(saved.dedicationTo).toBe('Beto');
    expect(saved.dedicationPosition).toBe('end');

    const clearSave = jest
      .fn()
      .mockResolvedValue(buildBook({ dedication: undefined }));
    const clear = buildService({ books: { saveDedication: clearSave } });

    const cleared = await clear.service.clearDedication('book-1', 'user-1');

    expect(cleared.dedicationTo).toBeUndefined();
    expect(clearSave).toHaveBeenCalledWith('book-1', 'user-1', null);
  });

  it('404s when dedicating or favoriting an unknown book', async () => {
    const { service } = buildService({
      books: {
        saveDedication: jest.fn().mockResolvedValue(undefined),
        setFavorite: jest.fn().mockResolvedValue(undefined),
      },
    });

    await expect(
      service.saveDedication('missing', 'user-1', {
        to: 'Ana',
        position: 'start',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      service.clearDedication('missing', 'user-1'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      service.setFavorite('missing', 'user-1', true),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('sets the favorite flag of a book', async () => {
    const setFavorite = jest
      .fn()
      .mockResolvedValue(buildSummary({ isFavorite: true }));
    const { service } = buildService({ books: { setFavorite } });

    const summary = await service.setFavorite('book-1', 'user-1', true);

    expect(setFavorite).toHaveBeenCalledWith('book-1', 'user-1', true);
    expect(summary).toMatchObject({ id: 'book-1', isFavorite: true });
  });
});
