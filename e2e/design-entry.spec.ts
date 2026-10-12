import { expect, test, type Page } from '@playwright/test';
import { mockBackend } from './helpers/mockBackend';

const DESIGN_TITLE = 'Mi fiesta de cumple';
const DESIGN_MESSAGE = 'Fiesta de cumple el sábado a las 17';

const COMPLETED_DESIGN_JOB = {
  id: 'design-job-1',
  bookId: 'design-1',
  status: 'completed',
  progress: 100,
  book: {
    id: 'design-1',
    version: 1,
    title: DESIGN_TITLE,
    totalPages: 1,
    pages: [{ pageNumber: 1, content: DESIGN_MESSAGE }],
  },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const DESIGN_DETAIL = {
  id: 'design-1',
  title: DESIGN_TITLE,
  message: DESIGN_MESSAGE,
  occasion: 'birthday',
  style: 'Acuarela',
  audience: 'child',
  imageUrl: 'https://signed.example/designs/design-1.png',
  version: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const DESIGN_SUMMARY = {
  id: 'design-1',
  title: DESIGN_TITLE,
  occasion: 'birthday',
  version: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

async function mockDesigns(page: Page): Promise<void> {
  await page.route('**/api/v1/designs**', (route) =>
    route.fulfill({ json: [DESIGN_SUMMARY] }),
  );
  await page.route('**/api/v1/designs/*', (route) =>
    route.fulfill({ json: DESIGN_DETAIL }),
  );
  await page.route('**/api/v1/ai/designs/generate', (route) =>
    route.fulfill({
      status: 202,
      json: { jobId: 'design-job-1', status: 'queued' },
    }),
  );
  await page.route('**/api/v1/ai/jobs/design-job-1/events', (route) =>
    route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: `event: status\ndata: ${JSON.stringify(COMPLETED_DESIGN_JOB)}\n\n`,
    }),
  );
}

test.describe('design entry (SPEC-029)', () => {
  test('creates a flyer through the accessible wizard', async ({ page }) => {
    await mockBackend(page);
    await mockDesigns(page);
    await page.goto('/');

    await page.getByText('Ana').click();
    await page.getByText('Diseñar').click();
    await expect(page.getByText('Elegí el motivo')).toBeVisible();
    await page.getByText('Cumpleaños').click();

    await expect(page.getByText('Escribí tu mensaje')).toBeVisible();
    await page.getByLabel('Mensaje del diseño').fill(DESIGN_MESSAGE);
    await expect(page.getByText('35 de 140 caracteres')).toBeVisible();
    await page.getByText('Elegir estilo').click();

    await expect(page.getByText('Elegí el estilo del diseño')).toBeVisible();
    await page.getByText('Acuarela').click();

    await expect(page.getByText(DESIGN_TITLE)).toBeVisible({ timeout: 20_000 });
  });

  test('lists diseños read-only in the library', async ({ page }) => {
    await mockBackend(page);
    await mockDesigns(page);
    await page.goto('/');

    await page.getByText('Ana').click();
    await page.getByText('Mi Biblioteca').click();
    await expect(page.getByText(DESIGN_TITLE)).toBeVisible();

    await page.getByText(DESIGN_TITLE).click();
    await expect(page.getByText(DESIGN_TITLE)).toBeVisible({
      timeout: 20_000,
    });
  });

  test('a failed design generation shows a localized error and lets the student retry', async ({
    page,
  }) => {
    await mockBackend(page);
    await mockDesigns(page);
    await page.route('**/api/v1/ai/designs/generate', (route) =>
      route.fulfill({
        status: 500,
        json: { statusCode: 500, code: 'INTERNAL', message: 'boom' },
      }),
    );
    await page.goto('/');

    await page.getByText('Ana').click();
    await page.getByText('Diseñar').click();
    await page.getByText('Cumpleaños').click();
    await page.getByLabel('Mensaje del diseño').fill(DESIGN_MESSAGE);
    await page.getByText('Elegir estilo').click();
    await page.getByText('Acuarela').click();

    await expect(page.getByText('Elegí el estilo del diseño')).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByText('Ocurrió un error inesperado. Podés intentarlo otra vez.'),
    ).toBeVisible();
    await expect(page.getByText('boom')).not.toBeVisible();
  });
});
