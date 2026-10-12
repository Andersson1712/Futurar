import { http, HttpResponse } from 'msw';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { server } from '../test/msw/server';
import {
  API_BASE,
  SAMPLE_DETAIL,
  SAMPLE_SUMMARY,
} from '../test/msw/handlers';
import { getStudentBook, listStudentBooks, saveBookDedication, clearBookDedication, setBookFavorite } from './backendBooks';

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'token-1' } },
      }),
      refreshSession: vi.fn(),
    },
  },
}));

describe('backendBooks (SPEC-017)', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('lists books filtered by profile', async () => {
    let profileId: string | null = null;

    server.use(
      http.get(`${API_BASE}/api/v1/books`, ({ request }) => {
        profileId = new URL(request.url).searchParams.get('profileId');

        return HttpResponse.json([SAMPLE_SUMMARY]);
      }),
    );

    const books = await listStudentBooks('student-1');

    expect(profileId).toBe('student-1');
    expect(books).toEqual([SAMPLE_SUMMARY]);
  });

  it('loads a book detail by id', async () => {
    const book = await getStudentBook('book-1');

    expect(book).toEqual(SAMPLE_DETAIL);
    expect(book.protagonist).toBe('Un dragón curioso');
  });

  it('saves a dedication with structured fields', async () => {
    const book = await saveBookDedication('book-1', {
      to: 'Beto',
      reason: 'su cumpleaños',
      position: 'end',
    });

    expect(book.dedicationTo).toBe('Beto');
    expect(book.dedicationReason).toBe('su cumpleaños');
    expect(book.dedicationPosition).toBe('end');
  });

  it('clears a dedication', async () => {
    const book = await clearBookDedication('book-1');

    expect(book.dedicationTo).toBeUndefined();
  });

  it('sets the favorite flag', async () => {
    const summary = await setBookFavorite('book-1', true);

    expect(summary.isFavorite).toBe(true);
  });
});
