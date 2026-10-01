import { apiFetch } from './backendApi';
import type {
  BookDetailPayload,
  BookDedicationPayload,
  BookSummaryPayload,
} from './bookTypes';

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

export async function saveBookDedication(
  bookId: string,
  dedication: BookDedicationPayload,
): Promise<BookDetailPayload> {
  return apiFetch<BookDetailPayload>(
    `/api/v1/books/${encodeURIComponent(bookId)}/dedication`,
    { method: 'PUT', body: JSON.stringify(dedication) },
  );
}

export async function clearBookDedication(
  bookId: string,
): Promise<BookDetailPayload> {
  return apiFetch<BookDetailPayload>(
    `/api/v1/books/${encodeURIComponent(bookId)}/dedication`,
    { method: 'DELETE' },
  );
}

export async function setBookFavorite(
  bookId: string,
  isFavorite: boolean,
): Promise<BookSummaryPayload> {
  return apiFetch<BookSummaryPayload>(
    `/api/v1/books/${encodeURIComponent(bookId)}/favorite`,
    { method: 'PUT', body: JSON.stringify({ isFavorite }) },
  );
}
