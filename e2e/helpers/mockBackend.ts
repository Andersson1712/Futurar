import type { Page } from '@playwright/test';

const STUDENT = {
  id: 'student-1',
  name: 'Ana',
  avatar_icon: 'person',
  is_active: true,
  age: 8,
  notes: null,
  created_at: '2026-01-01T00:00:00.000Z',
  teacher_id: 'teacher-1',
  student_settings: [
    {
      id: 'settings-1',
      student_id: 'student-1',
      scan_interval: 800,
      scan_columns: 2,
      voice_feedback: false,
      sound_enabled: false,
      sweep_enabled: true,
      input_mode: 'scan',
      line_height: 'normal',
      bold_titles: false,
      uppercase: false,
      voice_gender: 'auto',
      font_size: 'normal',
    },
  ],
};

const OPTIONS: Record<string, unknown[]> = {
  student_protagonists: [
    { id: 'p1', label: 'Un dragón', icon: 'pets', is_enabled: true },
  ],
  student_scenarios: [
    { id: 's1', label: 'Un bosque', icon: 'forest', is_enabled: true },
  ],
  student_missions: [
    { id: 'm1', label: 'Una estrella', icon: 'star', is_enabled: true },
  ],
  student_styles: [
    { id: 'st1', label: 'Acuarela', icon: 'brush', is_enabled: true },
  ],
};

const COMPLETED_JOB = {
  id: 'job-1',
  bookId: 'book-1',
  status: 'completed',
  progress: 100,
  book: {
    id: 'book-1',
    version: 1,
    title: 'La aventura del dragón',
    totalPages: 1,
    pages: [
      {
        pageNumber: 1,
        content: 'Había una vez un dragón curioso que buscaba una estrella.',
        imagePrompt: 'a curious dragon',
      },
    ],
  },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

export async function mockBackend(page: Page): Promise<void> {
  // Supabase REST (generic first, specific later: Playwright uses LIFO).
  await page.route('**/rest/v1/**', (route) => route.fulfill({ json: [] }));
  await page.route('**/rest/v1/students**', (route) =>
    route.fulfill({ json: [STUDENT] }),
  );

  for (const [table, rows] of Object.entries(OPTIONS)) {
    await page.route(`**/rest/v1/${table}**`, (route) =>
      route.fulfill({ json: rows }),
    );
  }

  // Nest backend.
  await page.route('**/api/v1/**', (route) =>
    route.fulfill({
      status: 404,
      json: { statusCode: 404, code: 'NOT_FOUND', message: 'not mocked' },
    }),
  );
  await page.route('**/api/v1/ai/books/generate', (route) =>
    route.fulfill({
      status: 202,
      json: { jobId: 'job-1', status: 'queued' },
    }),
  );
  await page.route('**/api/v1/ai/jobs/job-1/events', (route) =>
    route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: `event: status\ndata: ${JSON.stringify(COMPLETED_JOB)}\n\n`,
    }),
  );
  await page.route('**/api/v1/books**', (route) =>
    route.fulfill({ json: [] }),
  );
}
