import { ConfigService } from '@nestjs/config';
import { fakePinoLogger } from '../../observability/fake-pino-logger';
import type { ImageGeneratorPort } from '../domain/ports/image-generator.port';
import type {
  BookRepository,
  SaveBookInput,
  StoredBook,
} from '../../books/book.repository';
import type { BookStorage } from '../../books/book-storage.port';
import type { GeneratedBookDto } from '../dto/generated-book.dto';
import {
  BookPersistenceService,
  buildImagePath,
} from './book-persistence.service';

const BOOK: GeneratedBookDto = {
  title: 'La aventura del dragón',
  dedication: 'Para Ana',
  totalPages: 2,
  pages: [
    { pageNumber: 1, content: 'Había una vez', imagePrompt: 'a dragon' },
    { pageNumber: 2, content: 'Y fueron felices' },
  ],
};

const STORY_CONFIG = {
  protagonist: 'Un dragón curioso',
  scenery: 'Un bosque mágico',
  mission: 'Encontrar la estrella perdida',
  style: 'Acuarela',
  storySize: 'small',
  audience: 'child',
};

function buildService(
  options: { imagesEnabled?: boolean; imageFails?: boolean } = {},
) {
  const save = jest
    .fn()
    .mockImplementation((input: SaveBookInput): Promise<StoredBook> => {
      const now = new Date('2026-01-01T00:00:00.000Z');

      return Promise.resolve({
        id: 'book-1',
        userId: input.userId,
        profileId: input.profileId,
        title: input.snapshot.title,
        pageCount: input.snapshot.pages.length,
        currentVersion: 1,
        createdAt: now,
        updatedAt: now,
        version: {
          version: 1,
          title: input.snapshot.title,
          dedication: input.snapshot.dedication,
          pages: input.snapshot.pages,
          audit: input.audit,
          createdAt: now,
        },
      });
    });
  const books = { save } as unknown as BookRepository;
  const upload = jest.fn().mockResolvedValue(undefined);
  const signedUrl = jest
    .fn()
    .mockImplementation((path: string) =>
      Promise.resolve(`https://signed.example/${path}`),
    );
  const storage = { upload, signedUrl } as unknown as BookStorage;
  const generate = options.imageFails
    ? jest.fn().mockRejectedValue(new Error('image provider down'))
    : jest.fn().mockResolvedValue({
        data: Buffer.from('image'),
        mimeType: 'image/png',
        model: 'image-model',
      });
  const imageGenerator = { generate } as unknown as ImageGeneratorPort;
  const configService = new ConfigService(
    options.imagesEnabled
      ? {
          BOOK_IMAGES_ENABLED: true,
          BOOK_IMAGE_SIGNED_URL_TTL_SECONDS: 120,
        }
      : {},
  );
  const service = new BookPersistenceService(
    books,
    storage,
    imageGenerator,
    configService,
    fakePinoLogger(),
  );

  return { service, save, upload, signedUrl, generate };
}

function firstSaveInput(save: jest.Mock): SaveBookInput {
  const calls = save.mock.calls as unknown as Array<[SaveBookInput]>;

  return calls[0][0];
}

describe('BookPersistenceService', () => {
  it('persists the book without images when disabled', async () => {
    const { service, save, generate, upload, signedUrl } = buildService();

    const book = await service.persist({
      userId: 'user-1',
      profileId: 'student-1',
      book: BOOK,
      model: 'gemini-test',
      promptVersion: 'book/v1',
      storyConfig: STORY_CONFIG,
      generationJobId: 'job-1',
    });

    expect(generate).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
    expect(signedUrl).not.toHaveBeenCalled();

    const input = firstSaveInput(save);
    expect(input.snapshot.pages[0].imagePath).toBeUndefined();
    expect(input.profileId).toBe('student-1');
    expect(input.snapshot.config).toEqual(STORY_CONFIG);
    expect(input.audit).toMatchObject({
      promptVersion: 'book/v1',
      model: 'gemini-test',
      imageCount: 0,
      generationJobId: 'job-1',
      createdBy: 'user-1',
    });
    expect(book).toMatchObject({ id: 'book-1', version: 1, totalPages: 2 });
    expect(book.pages[0].imageUrl).toBeUndefined();
  });

  it('generates, uploads and signs page images when enabled', async () => {
    const { service, save, upload, signedUrl, generate } = buildService({
      imagesEnabled: true,
    });

    const book = await service.persist({
      userId: 'user-1',
      profileId: 'student-1',
      book: BOOK,
      model: 'gemini-test',
      promptVersion: 'book/v1',
      usage: { inputTokens: 10, outputTokens: 20 },
      storyConfig: STORY_CONFIG,
      generationJobId: 'job-1',
    });

    const path = buildImagePath('user-1', 'job-1', 1);

    expect(generate).toHaveBeenCalledWith({
      prompt: 'a dragon',
      aspectRatio: '1:1',
      imageSize: '1K',
    });
    expect(upload).toHaveBeenCalledWith(path, expect.any(Buffer), 'image/png');
    expect(firstSaveInput(save).audit.imageCount).toBe(1);
    expect(firstSaveInput(save).audit.inputTokens).toBe(10);
    expect(book.pages[0].imageUrl).toBe(`https://signed.example/${path}`);
    expect(book.pages[1].imageUrl).toBeUndefined();
    expect(signedUrl).toHaveBeenCalledWith(path, 120);
  });

  it('never fails the book when image generation fails', async () => {
    const { service, save, upload, generate } = buildService({
      imagesEnabled: true,
      imageFails: true,
    });

    const book = await service.persist({
      userId: 'user-1',
      profileId: 'student-1',
      book: BOOK,
      model: 'gemini-test',
      promptVersion: 'book/v1',
      storyConfig: STORY_CONFIG,
      generationJobId: 'job-1',
    });

    expect(generate).toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
    expect(firstSaveInput(save).audit.imageCount).toBe(0);
    expect(book.pages[0].imageUrl).toBeUndefined();
    expect(book.id).toBe('book-1');
  });

  it('skips pages without an image prompt even when images are enabled', async () => {
    const { service, generate } = buildService({ imagesEnabled: true });

    await service.persist({
      userId: 'user-1',
      profileId: 'student-1',
      book: {
        ...BOOK,
        pages: [{ pageNumber: 1, content: 'Sin prompt' }],
      },
      model: 'gemini-test',
      promptVersion: 'book/v1',
      storyConfig: STORY_CONFIG,
      generationJobId: 'job-1',
    });

    expect(generate).not.toHaveBeenCalled();
  });
});
