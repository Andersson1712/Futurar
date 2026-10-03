import type { Page } from '@playwright/test';

const PROFILE = {
  id: 'student-1',
  teacherId: 'teacher-1',
  name: 'Ana',
  age: 8,
  avatarIcon: 'person',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  settings: {
    scanInterval: 800,
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
  },
};

const PROFILE_OPTIONS = {
  protagonists: [{ id: 'p1', label: 'Un dragón', icon: 'pets', isEnabled: true }],
  scenarios: [{ id: 's1', label: 'Un bosque', icon: 'forest', isEnabled: true }],
  missions: [{ id: 'm1', label: 'Una estrella', icon: 'star', isEnabled: true }],
  styles: [{ id: 'st1', label: 'Acuarela', icon: 'brush', isEnabled: true }],
};

const CONTACT = {
  id: 'contact-1',
  profileId: 'student-1',
  name: 'Ana',
  relationship: 'mamá',
  dedicationReason: 'su cumpleaños',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
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
  // Legacy Supabase REST fallback (only Auth + legacy reads remain).
  await page.route('**/rest/v1/**', (route) => route.fulfill({ json: [] }));

  // Nest backend: generic 404 first, specific routes later (Playwright LIFO).
  await page.route('**/api/v1/**', (route) =>
    route.fulfill({
      status: 404,
      json: { statusCode: 404, code: 'NOT_FOUND', message: 'not mocked' },
    }),
  );
  await page.route('**/api/v1/profiles', (route) =>
    route.fulfill({ json: [PROFILE] }),
  );
  await page.route(/\/api\/v1\/profiles\?active=/, (route) =>
    route.fulfill({ json: [PROFILE] }),
  );
  // SPEC-024: public kiosk entry for students (no login required).
  await page.route('**/api/v1/profiles/active', (route) =>
    route.fulfill({ json: [PROFILE] }),
  );
  await page.route('**/api/v1/profiles/student-1/options', (route) =>
    route.fulfill({ json: PROFILE_OPTIONS }),
  );
  await page.route('**/api/v1/profiles/student-1/contacts', (route) =>
    route.fulfill({ json: [CONTACT] }),
  );
  await page.route('**/api/v1/profiles/student-1/actions', (route) =>
    route.fulfill({
      json: [
        {
          actionId: 'action-1',
          code: 'create',
          label: 'Crear Cuento',
          icon: 'auto_stories',
          sortOrder: 1,
          isEnabled: true,
        },
      ],
    }),
  );
  await page.route('**/api/v1/profiles/student-1/items', (route) =>
    route.fulfill({
      json: [
        {
          itemId: 'item-1',
          optionId: 'option-1',
          optionCode: 'protagonist',
          actionCode: 'create',
          label: 'Un dragón',
          icon: 'pets',
          level: 1,
          sortOrder: 1,
          isEnabled: true,
        },
      ],
    }),
  );
  await page.route('**/api/v1/actions**', (route) => {
    if (route.request().url().includes('/options')) {
      return route.fulfill({
        json: [
          {
            id: 'option-1',
            actionId: 'action-1',
            code: 'protagonist',
            label: 'Protagonista',
            icon: 'face',
            optionType: 'list',
            maxEnabled: 4,
            sortOrder: 1,
            isActive: true,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
            items: [
              {
                id: 'item-1',
                optionId: 'option-1',
                label: 'Un dragón',
                icon: 'pets',
                level: 1,
                sortOrder: 1,
                isActive: true,
                createdAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
              },
            ],
          },
        ],
      });
    }

    return route.fulfill({
      json: [
        {
          id: 'action-1',
          teacherId: 'teacher-1',
          code: 'create',
          label: 'Crear Cuento',
          icon: 'auto_stories',
          sortOrder: 1,
          isActive: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });
  });
  await page.route('**/api/v1/options/**', (route) =>
    route.fulfill({
      json: {
        id: 'item-2',
        optionId: 'option-1',
        label: 'Nueva opción',
        icon: 'star',
        level: 1,
        sortOrder: 2,
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    }),
  );
  await page.route('**/api/v1/contacts/**', (route) => {
    if (route.request().method() === 'DELETE') {
      return route.fulfill({ status: 204, body: '' });
    }

    return route.fulfill({ json: CONTACT });
  });
  await page.route('**/api/v1/profiles/student-1/settings', (route) =>
    route.fulfill({ json: PROFILE.settings }),
  );
  await page.route('**/api/v1/profiles/student-1', (route) =>
    route.fulfill({ json: PROFILE }),
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
  await page.route('**/api/v1/books/*/dedication', (route) =>
    route.fulfill({
      json: {
        id: 'book-1',
        title: 'La aventura del dragón',
        dedicationTo: 'Ana',
        dedicationReason: 'su cumpleaños',
        dedicationPosition: 'start',
        totalPages: 1,
        pages: [],
      },
    }),
  );
  await page.route('**/api/v1/books/*/favorite', (route) =>
    route.fulfill({ json: { id: 'book-1', isFavorite: true } }),
  );
}
