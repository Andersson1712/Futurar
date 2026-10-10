import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiErrorException } from '../common/errors/ai-error.exception';
import type { StoredBook, StoredBookSummary } from './book.repository';
import { BOOK_REPOSITORY } from './book.repository';
import type { BookDedication, BookRepository } from './book.repository';
import { BOOK_STORAGE } from './book-storage.port';
import type { BookStorage } from './book-storage.port';
import { DEFAULT_SIGNED_URL_TTL_SECONDS } from '../ai/application/book-persistence.service';
import {
  BookDetailDto,
  BookSummaryDto,
  SaveDedicationDto,
} from './dto/book.dto';

@Injectable()
export class BooksService {
  constructor(
    @Inject(BOOK_REPOSITORY) private readonly books: BookRepository,
    @Inject(BOOK_STORAGE) private readonly storage: BookStorage,
    private readonly configService: ConfigService,
  ) {}

  async list(userId: string, profileId?: string): Promise<BookSummaryDto[]> {
    const books = await this.books.listByUser(userId, profileId);

    return books.map(toSummaryDto);
  }

  async get(bookId: string, userId: string): Promise<BookDetailDto> {
    const book = await this.books.findById(bookId, userId);

    if (!book) {
      throw new AiErrorException(404, 'NOT_FOUND', 'Book not found');
    }

    return this.toDetailDto(book);
  }

  async remove(bookId: string, userId: string): Promise<void> {
    const deleted = await this.books.softDelete(bookId, userId);

    if (!deleted) {
      throw new AiErrorException(404, 'NOT_FOUND', 'Book not found');
    }
  }

  async saveDedication(
    bookId: string,
    userId: string,
    dto: SaveDedicationDto,
  ): Promise<BookDetailDto> {
    const dedication: BookDedication = {
      to: dto.to,
      reason: dto.reason,
      position: dto.position,
    };
    const updated = await this.books.saveDedication(bookId, userId, dedication);

    if (!updated) {
      throw new AiErrorException(404, 'NOT_FOUND', 'Book not found');
    }

    return this.toDetailDto(updated);
  }

  async clearDedication(
    bookId: string,
    userId: string,
  ): Promise<BookDetailDto> {
    const updated = await this.books.saveDedication(bookId, userId, null);

    if (!updated) {
      throw new AiErrorException(404, 'NOT_FOUND', 'Book not found');
    }

    return this.toDetailDto(updated);
  }

  async setFavorite(
    bookId: string,
    userId: string,
    isFavorite: boolean,
  ): Promise<BookSummaryDto> {
    const updated = await this.books.setFavorite(bookId, userId, isFavorite);

    if (!updated) {
      throw new AiErrorException(404, 'NOT_FOUND', 'Book not found');
    }

    return toSummaryDto(updated);
  }

  private async toDetailDto(book: StoredBook): Promise<BookDetailDto> {
    const ttlSeconds =
      this.configService.get<number>('BOOK_IMAGE_SIGNED_URL_TTL_SECONDS') ??
      DEFAULT_SIGNED_URL_TTL_SECONDS;

    const pages = await Promise.all(
      book.version.pages.map(async (page) => ({
        pageNumber: page.pageNumber,
        content: page.content,
        imagePrompt: page.imagePrompt,
        imageUrl: page.imagePath
          ? await this.storage.signedUrl(page.imagePath, ttlSeconds)
          : undefined,
      })),
    );

    return {
      id: book.id,
      title: book.title,
      dedication: book.version.dedication,
      dedicationTo: book.dedication?.to,
      dedicationReason: book.dedication?.reason,
      dedicationPosition: book.dedication?.position,
      protagonist: book.version.config?.protagonist ?? '',
      scenery: book.version.config?.scenery ?? '',
      mission: book.version.config?.mission ?? '',
      style: book.version.config?.style ?? '',
      version: book.currentVersion,
      totalPages: pages.length,
      pages,
      createdAt: book.createdAt.toISOString(),
      updatedAt: book.updatedAt.toISOString(),
    };
  }
}

function toSummaryDto(summary: StoredBookSummary): BookSummaryDto {
  return {
    id: summary.id,
    title: summary.title,
    pageCount: summary.pageCount,
    version: summary.currentVersion,
    isFavorite: summary.isFavorite,
    createdAt: summary.createdAt.toISOString(),
    updatedAt: summary.updatedAt.toISOString(),
  };
}
