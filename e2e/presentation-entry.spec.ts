import { expect, test, type Page } from '@playwright/test';
import { mockBackend } from './helpers/mockBackend';

const PRESENTATION_TITLE = 'Dinosaurios asombrosos';
const PRESENTATION_TOPIC = 'Los dinosaurios';

const COMPLETED_PRESENTATION_JOB = {
  id: 'presentation-job-1',
  bookId: 'presentation-1',
  status: 'completed',
  progress: 100,
  book: {
    id: 'presentation-1',
    version: 1,
    title: PRESENTATION_TITLE,
    totalPages: 5,
    pages: [{ pageNumber: 1, content: 'Diapositiva 1: Qué son' }],
  },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const PRESENTATION_DETAIL = {
  id: 'presentation-1',
  title: PRESENTATION_TITLE,
  topic: PRESENTATION_TOPIC,
  style: 'Acuarela',
  audience: 'child',
  slideCount: 5,
  slides: [
    {
      title: 'Qué son',
      bullets: ['Vivieron hace millones de años', 'Eran reptiles gigantes'],
      imageUrl: 'https://signed.example/presentations/slide-0.png',
    },
  ],
  version: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const PRESENTATION_SUMMARY = {
  id: 'presentation-1',
  title: PRESENTATION_TITLE,
  topic: PRESENTATION_TOPIC,
  slideCount: 5,
  version: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

async function mockPresentations(page: Page): Promise<void> {
  await page.route('**/api/v1/presentations**', (route) =>
    route.fulfill({ json: [PRESENTATION_SUMMARY] }),
  );
  await page.route('**/api/v1/presentations/*', (route) =>
    route.fulfill({ json: PRESENTATION_DETAIL }),
  );
  await page.route('**/api/v1/ai/presentations/generate', (route) =>
    route.fulfill({
      status: 202,
      json: { jobId: 'presentation-job-1', status: 'queued' },
    }),
  );
  await page.route('**/api/v1/ai/jobs/presentation-job-1/events', (route) =>
    route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: `event: status\ndata: ${JSON.stringify(COMPLETED_PRESENTATION_JOB)}\n\n`,
    }),
  );
}

test.describe('presentation entry (SPEC-029B)', () => {
  test('creates a deck through the accessible wizard', async ({ page }) => {
    await mockBackend(page);
    await mockPresentations(page);
    await page.goto('/');

    await page.getByText('Ana').click();
    await page.getByText('Presentar').click();
    await expect(page.getByText('Elegí el tema')).toBeVisible();
    await page.getByLabel('Tema de la presentación').fill(PRESENTATION_TOPIC);
    await expect(page.getByText('15 de 120 caracteres')).toBeVisible();
    await page.getByText('Elegir cantidad').click();

    await expect(page.getByText('¿Cuántas diapositivas?')).toBeVisible();
    await page.getByText('5 diapositivas').click();

    await expect(page.getByText('Elegí el estilo de la presentación')).toBeVisible();
    await page.getByText('Acuarela').click();

    await expect(page.getByText(PRESENTATION_TITLE)).toBeVisible({ timeout: 20_000 });
  });

  test('lists presentaciones read-only in the library', async ({ page }) => {
    await mockBackend(page);
    await mockPresentations(page);
    await page.goto('/');

    await page.getByText('Ana').click();
    await page.getByText('Mi Biblioteca').click();
    await expect(page.getByText(PRESENTATION_TITLE)).toBeVisible();

    await page.getByText(PRESENTATION_TITLE).click();
    await expect(page.getByText(PRESENTATION_TITLE)).toBeVisible({
      timeout: 20_000,
    });
  });

  test('a failed presentation generation shows a localized error and lets the student retry', async ({
    page,
  }) => {
    await mockBackend(page);
    await mockPresentations(page);
    await page.route('**/api/v1/ai/presentations/generate', (route) =>
      route.fulfill({
        status: 500,
        json: { statusCode: 500, code: 'INTERNAL', message: 'boom' },
      }),
    );
    await page.goto('/');

    await page.getByText('Ana').click();
    await page.getByText('Presentar').click();
    await page.getByLabel('Tema de la presentación').fill(PRESENTATION_TOPIC);
    await page.getByText('Elegir cantidad').click();
    await page.getByText('5 diapositivas').click();
    await page.getByText('Acuarela').click();

    await expect(page.getByText('Elegí el estilo de la presentación')).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByText('Ocurrió un error inesperado. Podés intentarlo otra vez.'),
    ).toBeVisible();
    await expect(page.getByText('boom')).not.toBeVisible();
  });
});
