import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  BookDedication,
  BookRepository,
  SaveBookInput,
  StoredBook,
  StoredBookSummary,
} from './book.repository';

interface InMemoryBook {
  summary: StoredBookSummary;
  book: StoredBook;
}

@Injectable()
export class InMemoryBookRepository implements BookRepository {
  private readonly books = new Map<string, InMemoryBook>();
  private readonly jobIndex = new Map<string, string>();

  save(input: SaveBookInput): Promise<StoredBook> {
    const jobId = input.audit.generationJobId;

    if (jobId) {
      const existingId = this.jobIndex.get(jobId);

      if (existingId) {
        return Promise.resolve(this.books.get(existingId)!.book);
      }
    }

    const now = new Date();
    const id = randomUUID();
    const version = {
      version: 1,
      title: input.snapshot.title,
      dedication: input.snapshot.dedication,
      pages: input.snapshot.pages,
      audit: input.audit,
      createdAt: now,
    };
    const summary: StoredBookSummary = {
      id,
      userId: input.userId,
      profileId: input.profileId,
      title: input.snapshot.title,
      pageCount: input.snapshot.pages.length,
      currentVersion: 1,
      isFavorite: false,
      createdAt: now,
      updatedAt: now,
    };
    const book: StoredBook = {
      ...summary,
      version,
      dedication: input.dedication,
    };

    this.books.set(id, { summary, book });

    if (jobId) {
      this.jobIndex.set(jobId, id);
    }

    return Promise.resolve(book);
  }

  findById(bookId: string, userId: string): Promise<StoredBook | undefined> {
    const stored = this.books.get(bookId);

    if (!stored || stored.summary.userId !== userId) {
      return Promise.resolve(undefined);
    }

    if (stored.summary.deletedAt) {
      return Promise.resolve(undefined);
    }

    return Promise.resolve(stored.book);
  }

  listByUser(userId: string, profileId?: string): Promise<StoredBookSummary[]> {
    const summaries = [...this.books.values()]
      .map((stored) => stored.summary)
      .filter(
        (summary) =>
          summary.userId === userId &&
          !summary.deletedAt &&
          (profileId === undefined || summary.profileId === profileId),
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 100);

    return Promise.resolve(summaries);
  }

  softDelete(bookId: string, userId: string): Promise<boolean> {
    const stored = this.books.get(bookId);

    if (
      !stored ||
      stored.summary.userId !== userId ||
      stored.summary.deletedAt
    ) {
      return Promise.resolve(false);
    }

    const deletedAt = new Date();
    stored.summary.deletedAt = deletedAt;
    stored.summary.updatedAt = deletedAt;
    stored.book.deletedAt = deletedAt;
    stored.book.updatedAt = deletedAt;

    return Promise.resolve(true);
  }

  saveDedication(
    bookId: string,
    userId: string,
    dedication: BookDedication | null,
  ): Promise<StoredBook | undefined> {
    const stored = this.books.get(bookId);

    if (
      !stored ||
      stored.summary.userId !== userId ||
      stored.summary.deletedAt
    ) {
      return Promise.resolve(undefined);
    }

    const now = new Date();
    stored.book.dedication = dedication ?? undefined;
    stored.book.updatedAt = now;
    stored.summary.updatedAt = now;

    return Promise.resolve(stored.book);
  }

  setFavorite(
    bookId: string,
    userId: string,
    isFavorite: boolean,
  ): Promise<StoredBookSummary | undefined> {
    const stored = this.books.get(bookId);

    if (
      !stored ||
      stored.summary.userId !== userId ||
      stored.summary.deletedAt
    ) {
      return Promise.resolve(undefined);
    }

    const now = new Date();
    stored.summary.isFavorite = isFavorite;
    stored.summary.updatedAt = now;
    stored.book.isFavorite = isFavorite;
    stored.book.updatedAt = now;

    return Promise.resolve(stored.summary);
  }
}
