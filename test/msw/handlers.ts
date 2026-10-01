import { http, HttpResponse } from 'msw';
import type {
  BookDetailPayload,
  BookSummaryPayload,
  GeneratedBookPayload,
  JobStatusPayload,
} from '../../services/bookTypes';

export const API_BASE = 'http://localhost:3001';

export const SAMPLE_BOOK: GeneratedBookPayload = {
  id: 'book-1',
  version: 1,
  title: 'La aventura del dragón',
  totalPages: 1,
  pages: [
    {
      pageNumber: 1,
      content: 'Había una vez un dragón curioso.',
      imageUrl: 'https://signed.example/page-1.png',
    },
  ],
};

export const SAMPLE_JOB: JobStatusPayload = {
  id: 'job-1',
  bookId: 'book-1',
  status: 'completed',
  progress: 100,
  book: SAMPLE_BOOK,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

export const SAMPLE_SUMMARY: BookSummaryPayload = {
  id: 'book-1',
  title: 'La aventura del dragón',
  pageCount: 1,
  version: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

export const SAMPLE_DETAIL: BookDetailPayload = {
  ...SAMPLE_BOOK,
  protagonist: 'Un dragón curioso',
  scenery: 'Un bosque mágico',
  mission: 'Encontrar la estrella perdida',
  style: 'Acuarela',
  version: 1,
  totalPages: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

export function sseResponse(
  events: Array<{ type: string; data: unknown }>,
): HttpResponse<ReadableStream<Uint8Array>> {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const event of events) {
        controller.enqueue(
          encoder.encode(
            `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`,
          ),
        );
      }
      controller.close();
    },
  });

  return new HttpResponse(stream, {
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

export const handlers = [
  http.post(`${API_BASE}/api/v1/ai/books/generate`, () =>
    HttpResponse.json({ jobId: 'job-1', status: 'queued' }, { status: 202 }),
  ),
  http.get(`${API_BASE}/api/v1/ai/jobs/:id/events`, () =>
    sseResponse([
      { type: 'status', data: { ...SAMPLE_JOB, status: 'processing', progress: 60 } },
      { type: 'status', data: SAMPLE_JOB },
    ]),
  ),
  http.get(`${API_BASE}/api/v1/ai/jobs/:id`, () =>
    HttpResponse.json(SAMPLE_JOB),
  ),
  http.get(`${API_BASE}/api/v1/books`, () =>
    HttpResponse.json([SAMPLE_SUMMARY]),
  ),
  http.get(`${API_BASE}/api/v1/books/:id`, () =>
    HttpResponse.json(SAMPLE_DETAIL),
  ),
  http.delete(`${API_BASE}/api/v1/books/:id`, () =>
    new HttpResponse(null, { status: 204 }),
  ),
];
