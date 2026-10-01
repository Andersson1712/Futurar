import { apiFetch } from './backendApi';
import type { BookDetailPayload, BookSummaryPayload } from './bookTypes';

export async function listStudentBooks(
  profileId: string,
): Promise<BookSummaryPayload[]> {
  return apiFetch<BookSummaryPayload[]>(
    `/api/v1/books?profileId=${encodeURIComponent(profileId)}`,
  );
}

export async function getStudentBook(
  bookId: string,
): Promise<BookDetailPayload> {
  return apiFetch<BookDetailPayload>(
    `/api/v1/books/${encodeURIComponent(bookId)}`,
  );
}
