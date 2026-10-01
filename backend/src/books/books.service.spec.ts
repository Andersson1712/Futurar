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
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function buildBook(): StoredBook {
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
});
