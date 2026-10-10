import { http, HttpResponse } from 'msw';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { server } from '../test/msw/server';
import { API_BASE } from '../test/msw/handlers';
import {
  getExportDownload,
  requestBookExport,
  requestDesignExport,
} from './backendExports';

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

describe('backendExports (SPEC-031)', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('requests a book export with an idempotency key', async () => {
    let idempotencyKey: string | null = null;
    let body: unknown = null;

    server.use(
      http.post(`${API_BASE}/api/v1/exports/books/:id`, async ({ request }) => {
        idempotencyKey = request.headers.get('Idempotency-Key');
        body = await request.json();

        return HttpResponse.json({ jobId: 'job-1', status: 'queued' }, { status: 202 });
      }),
    );

    const response = await requestBookExport('book-1', { format: 'epub' });

    expect(response).toEqual({ jobId: 'job-1', status: 'queued' });
    expect(typeof idempotencyKey).toBe('string');
    expect(body).toMatchObject({ format: 'epub' });
  });

  it('requests a design export with an idempotency key', async () => {
    let body: unknown = null;

    server.use(
      http.post(`${API_BASE}/api/v1/exports/designs/:id`, async ({ request }) => {
        body = await request.json();

        return HttpResponse.json({ jobId: 'job-2', status: 'queued' }, { status: 202 });
      }),
    );

    const response = await requestDesignExport('design-1', { format: 'pdf' });

    expect(response).toEqual({ jobId: 'job-2', status: 'queued' });
    expect(body).toMatchObject({ format: 'pdf' });
  });

  it('fetches the download URL for a ready job', async () => {
    server.use(
      http.get(`${API_BASE}/api/v1/exports/:jobId/download`, () =>
        HttpResponse.json({ downloadUrl: 'https://signed.example/book.epub' }),
      ),
    );

    const response = await getExportDownload('job-1');

    expect(response).toEqual({
      downloadUrl: 'https://signed.example/book.epub',
    });
  });
});
