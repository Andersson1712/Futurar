import { expect, test, type Page } from '@playwright/test';
import { mockBackend } from './helpers/mockBackend';

const BOARD_TITLE = 'Tablero de emociones';
const BOARD_TOPIC = 'Cómo me siento hoy';

const COMPLETED_BOARD_JOB = {
  id: 'board-job-1',
  bookId: 'board-1',
  status: 'completed',
  progress: 100,
  book: {
    id: 'board-1',
    version: 1,
    title: BOARD_TITLE,
    totalPages: 6,
    pages: [{ pageNumber: 1, content: 'Contento' }],
  },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const BOARD_DETAIL = {
  id: 'board-1',
  title: BOARD_TITLE,
  kind: 'feelings',
  topic: BOARD_TOPIC,
  style: 'Pictogramas',
  audience: 'child',
  cellCount: 6,
  cells: [
    {
      label: 'Contento',
      imageUrl: 'https://signed.example/communications/cell-0.png',
    },
  ],
  version: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const BOARD_SUMMARY = {
  id: 'board-1',
  title: BOARD_TITLE,
  kind: 'feelings',
  cellCount: 6,
  version: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

async function mockBoards(page: Page): Promise<void> {
  await page.route('**/api/v1/communications**', (route) =>
    route.fulfill({ json: [BOARD_SUMMARY] }),
  );
  await page.route('**/api/v1/communications/*', (route) =>
    route.fulfill({ json: BOARD_DETAIL }),
  );
  await page.route('**/api/v1/ai/communications/generate', (route) =>
    route.fulfill({
      status: 202,
      json: { jobId: 'board-job-1', status: 'queued' },
    }),
  );
  await page.route('**/api/v1/ai/jobs/board-job-1/events', (route) =>
    route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: `event: status\ndata: ${JSON.stringify(COMPLETED_BOARD_JOB)}\n\n`,
    }),
  );
}

test.describe('board entry (SPEC-029C)', () => {
  test('creates a board through the accessible wizard', async ({ page }) => {
    await mockBackend(page);
    await mockBoards(page);
    await page.goto('/');

    await page.getByText('Ana').click();
    await page.getByText('Comunicar').click();
    await expect(page.getByText('Elegí el tipo de tablero')).toBeVisible();
    await page.getByText('Cómo me siento').click();

    await expect(page.getByText('Elegí el tema')).toBeVisible();
    await page.getByLabel('Tema del tablero').fill(BOARD_TOPIC);
    await expect(page.getByText('18 de 120 caracteres')).toBeVisible();
    await page.getByText('Elegir cantidad').click();

    await expect(page.getByText('¿Cuántas celdas?')).toBeVisible();
    await page.getByText('6 celdas').click();

    await expect(page.getByText('Elegí el estilo del tablero')).toBeVisible();
    await page.getByText('Acuarela').click();

    await expect(page.getByText(BOARD_TITLE)).toBeVisible({ timeout: 20_000 });
  });

  test('lists boards read-only in the library and opens the use view', async ({
    page,
  }) => {
    await mockBackend(page);
    await mockBoards(page);
    await page.goto('/');

    await page.getByText('Ana').click();
    await page.getByText('Mi Biblioteca').click();
    await expect(page.getByText(BOARD_TITLE)).toBeVisible();

    await page.getByText(BOARD_TITLE).click();
    await expect(page.getByText(BOARD_TITLE)).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Contento')).toBeVisible();
  });

  test('a failed board generation shows a localized error and lets the student retry', async ({
    page,
  }) => {
    await mockBackend(page);
    await mockBoards(page);
    await page.route('**/api/v1/ai/communications/generate', (route) =>
      route.fulfill({
        status: 500,
        json: { statusCode: 500, code: 'INTERNAL', message: 'boom' },
      }),
    );
    await page.goto('/');

    await page.getByText('Ana').click();
    await page.getByText('Comunicar').click();
    await page.getByText('Cómo me siento').click();
    await page.getByLabel('Tema del tablero').fill(BOARD_TOPIC);
    await page.getByText('Elegir cantidad').click();
    await page.getByText('6 celdas').click();
    await page.getByText('Acuarela').click();

    await expect(page.getByText('Elegí el estilo del tablero')).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByText('Ocurrió un error inesperado. Podés intentarlo otra vez.'),
    ).toBeVisible();
    await expect(page.getByText('boom')).not.toBeVisible();
  });
});
