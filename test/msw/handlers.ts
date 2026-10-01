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
  isFavorite: false,
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
  isFavorite: false,
  dedicationTo: 'Ana',
  dedicationReason: 'su cumpleaños',
  dedicationPosition: 'start',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

export const SAMPLE_CONTACT = {
  id: 'contact-1',
  profileId: 'student-1',
  name: 'Ana',
  relationship: 'mamá',
  dedicationReason: 'su cumpleaños',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

export const SAMPLE_PROFILE_SETTINGS = {
  scanInterval: 3000,
  scanColumns: 2,
  voiceFeedback: false,
  soundEnabled: false,
  sweepEnabled: true,
  inputMode: 'scan',
  lineHeight: 'normal',
  boldTitles: false,
  uppercase: false,
  voiceGender: 'auto',
  fontSize: 'normal',
  modules: { create: true, library: true, design: false },
  bookStorySize: 'medium',
  bookAudience: 'child',
};

export const SAMPLE_PROFILE = {
  id: 'student-1',
  teacherId: 'teacher-1',
  name: 'Ana',
  age: 8,
  avatarIcon: 'person',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  settings: SAMPLE_PROFILE_SETTINGS,
};

export const SAMPLE_PROFILE_OPTIONS = {
  protagonists: [
    { id: 'p1', label: 'Un dragón', icon: 'pets', isEnabled: true },
  ],
  scenarios: [
    { id: 's1', label: 'Un bosque', icon: 'forest', isEnabled: true },
  ],
  missions: [
    { id: 'm1', label: 'Una estrella', icon: 'star', isEnabled: true },
  ],
  styles: [
    { id: 'st1', label: 'Acuarela', icon: 'brush', isEnabled: true },
  ],
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
  http.get(`${API_BASE}/api/v1/profiles`, () =>
    HttpResponse.json([SAMPLE_PROFILE]),
  ),
  http.post(`${API_BASE}/api/v1/profiles`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;

    return HttpResponse.json(
      {
        ...SAMPLE_PROFILE,
        ...body,
        id: 'student-2',
        settings: SAMPLE_PROFILE_SETTINGS,
      },
      { status: 201 },
    );
  }),
  http.get(`${API_BASE}/api/v1/profiles/:id`, () =>
    HttpResponse.json(SAMPLE_PROFILE),
  ),
  http.patch(`${API_BASE}/api/v1/profiles/:id`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;

    return HttpResponse.json({ ...SAMPLE_PROFILE, ...body });
  }),
  http.delete(
    `${API_BASE}/api/v1/profiles/:id`,
    () => new HttpResponse(null, { status: 204 }),
  ),
  http.put(`${API_BASE}/api/v1/profiles/:id/settings`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;

    return HttpResponse.json({ ...SAMPLE_PROFILE_SETTINGS, ...body });
  }),
  http.get(`${API_BASE}/api/v1/profiles/:id/options`, () =>
    HttpResponse.json(SAMPLE_PROFILE_OPTIONS),
  ),
  http.delete(`${API_BASE}/api/v1/books/:id`, () =>
    new HttpResponse(null, { status: 204 }),
  ),
  http.put(`${API_BASE}/api/v1/books/:id/dedication`, async ({ request }) => {
    const body = (await request.json()) as {
      to: string;
      reason?: string;
      position: 'start' | 'end';
    };

    return HttpResponse.json({
      ...SAMPLE_DETAIL,
      dedicationTo: body.to,
      dedicationReason: body.reason,
      dedicationPosition: body.position,
    });
  }),
  http.delete(`${API_BASE}/api/v1/books/:id/dedication`, () =>
    HttpResponse.json({
      ...SAMPLE_DETAIL,
      dedicationTo: undefined,
      dedicationReason: undefined,
      dedicationPosition: undefined,
    }),
  ),
  http.put(`${API_BASE}/api/v1/books/:id/favorite`, async ({ request }) => {
    const body = (await request.json()) as { isFavorite: boolean };

    return HttpResponse.json({ ...SAMPLE_SUMMARY, isFavorite: body.isFavorite });
  }),
  http.get(`${API_BASE}/api/v1/profiles/:id/contacts`, () =>
    HttpResponse.json([SAMPLE_CONTACT]),
  ),
  http.post(`${API_BASE}/api/v1/profiles/:id/contacts`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;

    return HttpResponse.json(
      { ...SAMPLE_CONTACT, ...body, id: 'contact-2' },
      { status: 201 },
    );
  }),
  http.patch(`${API_BASE}/api/v1/contacts/:id`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;

    return HttpResponse.json({ ...SAMPLE_CONTACT, ...body });
  }),
  http.delete(
    `${API_BASE}/api/v1/contacts/:id`,
    () => new HttpResponse(null, { status: 204 }),
  ),
  http.get(`${API_BASE}/api/v1/ai/credentials`, () => HttpResponse.json([])),
  http.put(
    `${API_BASE}/api/v1/ai/credentials/:provider`,
    async ({ request }) => {
      const body = (await request.json()) as { apiKey?: string };
      const key = body.apiKey ?? '';

      return HttpResponse.json({
        provider: 'gemini',
        keyHint: key.slice(-4),
        status: 'active',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      });
    },
  ),
  http.delete(`${API_BASE}/api/v1/ai/credentials/:provider`, () =>
    new HttpResponse(null, { status: 204 }),
  ),
];
