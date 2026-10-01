import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { GeneratedBookDto } from '../dto/generated-book.dto';
import type { TextGenerationUsage } from '../domain/ports/text-generator.port';
import type { ImageGeneratorPort } from '../domain/ports/image-generator.port';
import { IMAGE_GENERATOR } from '../tokens';
import { BOOK_REPOSITORY } from '../../books/book.repository';
import type {
  BookDedication,
  BookRepository,
  BookStoryConfig,
  StoredPage,
} from '../../books/book.repository';
import { BOOK_STORAGE } from '../../books/book-storage.port';
import type { BookStorage } from '../../books/book-storage.port';

export const DEFAULT_SIGNED_URL_TTL_SECONDS = 3_600;
export const BOOK_IMAGE_ASPECT_RATIO = '1:1';
export const BOOK_IMAGE_SIZE = '1K';

export interface PersistBookInput {
  userId: string;
  profileId?: string;
  book: GeneratedBookDto;
  storyConfig: BookStoryConfig;
  dedication?: BookDedication;
  model: string;
  promptVersion: string;
  usage?: TextGenerationUsage;
  generationJobId: string;
}

@Injectable()
export class BookPersistenceService {
  private readonly logger = new Logger(BookPersistenceService.name);

  constructor(
    @Inject(BOOK_REPOSITORY) private readonly books: BookRepository,
    @Inject(BOOK_STORAGE) private readonly storage: BookStorage,
    @Inject(IMAGE_GENERATOR)
    private readonly imageGenerator: ImageGeneratorPort,
    private readonly configService: ConfigService,
  ) {}

  async persist(input: PersistBookInput): Promise<GeneratedBookDto> {
    const imagesEnabled =
      this.configService.get<boolean>('BOOK_IMAGES_ENABLED') === true;
    const ttlSeconds =
      this.configService.get<number>('BOOK_IMAGE_SIGNED_URL_TTL_SECONDS') ??
      DEFAULT_SIGNED_URL_TTL_SECONDS;

    const pages: StoredPage[] = [];
    let imageCount = 0;

    for (const page of input.book.pages) {
      let imagePath: string | undefined;

      if (imagesEnabled && page.imagePrompt) {
        imagePath = buildImagePath(
          input.userId,
          input.generationJobId,
          page.pageNumber,
        );

        try {
          const image = await this.imageGenerator.generate({
            prompt: page.imagePrompt,
            aspectRatio: BOOK_IMAGE_ASPECT_RATIO,
            imageSize: BOOK_IMAGE_SIZE,
          });
          await this.storage.upload(imagePath, image.data, image.mimeType);
          imageCount += 1;
        } catch (error) {
          imagePath = undefined;
          this.logger.warn(
            `Image generation failed for page ${page.pageNumber}: ${describeError(error)}`,
          );
        }
      }

      pages.push({
        pageNumber: page.pageNumber,
        content: page.content,
        imagePrompt: page.imagePrompt,
        imagePath,
      });
    }

    const stored = await this.books.save({
      userId: input.userId,
      profileId: input.profileId,
      snapshot: {
        title: input.book.title,
        dedication: input.book.dedication,
        config: input.storyConfig,
        pages,
      },
      audit: {
        promptVersion: input.promptVersion,
        model: input.model,
        inputTokens: input.usage?.inputTokens,
        outputTokens: input.usage?.outputTokens,
        imageCount,
        generationJobId: input.generationJobId,
        createdBy: input.userId,
      },
      dedication: input.dedication,
    });

    const signedPages = await Promise.all(
      stored.version.pages.map(async (page) => ({
        pageNumber: page.pageNumber,
        content: page.content,
        imagePrompt: page.imagePrompt,
        imageUrl: page.imagePath
          ? await this.storage.signedUrl(page.imagePath, ttlSeconds)
          : undefined,
      })),
    );

    return {
      id: stored.id,
      version: stored.currentVersion,
      title: stored.title,
      dedication: stored.version.dedication,
      totalPages: signedPages.length,
      pages: signedPages,
    };
  }
}

export function buildImagePath(
  userId: string,
  generationJobId: string,
  pageNumber: number,
): string {
  return `users/${userId}/jobs/${generationJobId}/page-${pageNumber}.png`;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown error';
}
