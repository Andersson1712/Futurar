import { expect, test, type Page } from '@playwright/test';
import { mockBackend } from './helpers/mockBackend';

const BOOK_TITLE = 'La aventura del dragón';

const BOOK_SUMMARY = {
  id: 'book-1',
  title: BOOK_TITLE,
  pageCount: 2,
  version: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const BOOK_DETAIL = {
  id: 'book-1',
  title: BOOK_TITLE,
  content: 'Había una vez un dragón.',
  protagonist: 'Un dragón',
  scenery: 'Un bosque',
  mission: 'Una estrella',
  style: 'Acuarela',
  pages: [{ pageNumber: 1, content: 'Había una vez un dragón.' }],
  image_url: null,
  type: 'story',
  created_at: '2026-01-01T00:00:00.000Z',
  is_favorite: false,
  dedication_to: null,
  dedication_reason: null,
  dedication_position: null,
};

const COMPLETED_EXPORT_JOB = {
  id: 'export-job-1',
  bookId: 'book-1',
  status: 'completed',
  progress: 100,
  book: {
    id: 'book-1',
    version: 1,
    title: BOOK_TITLE,
    totalPages: 2,
    pages: [{ pageNumber: 1, content: 'Había una vez un dragón.' }],
  },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

async function mockExport(page: Page): Promise<void> {
  await page.route('**/api/v1/books**', (route) =>
    route.fulfill({ json: [BOOK_SUMMARY] }),
  );
  await page.route('**/api/v1/books/*', (route) =>
    route.fulfill({ json: BOOK_DETAIL }),
  );
  await page.route('**/api/v1/exports/books/*', (route) =>
    route.fulfill({
      status: 202,
      json: { jobId: 'export-job-1', status: 'queued' },
    }),
  );
  await page.route('**/api/v1/ai/jobs/export-job-1/events', (route) =>
    route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: `event: status\ndata: ${JSON.stringify(COMPLETED_EXPORT_JOB)}\n\n`,
    }),
  );
  await page.route('**/api/v1/exports/export-job-1/download', (route) =>
    route.fulfill({
      status: 200,
      headers: {
        'content-type': 'application/epub+zip',
        'content-disposition': 'attachment; filename="book.epub"',
      },
      body: 'fake-epub-bytes',
    }),
  );
}

test.describe('book EPUB export (SPEC-031)', () => {
  test('downloads a server-built EPUB from the details view', async ({
    page,
  }) => {
    await mockBackend(page);
    await mockExport(page);
    await page.goto('/');

    await page.getByText('Ana').click();
    await page.getByText('Mi Biblioteca').click();
    await expect(page.getByText(BOOK_TITLE)).toBeVisible();

    await page.getByText(BOOK_TITLE).click();
    await expect(page.getByText('Descargar PDF')).toBeVisible();
    await expect(page.getByText('Descargar EPUB')).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByText('Descargar EPUB').click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/\.epub$/);
  });

  test('a failed export shows a localized error and never exposes raw text', async ({
    page,
  }) => {
    await mockBackend(page);
    await mockExport(page);
    await page.route('**/api/v1/exports/books/*', (route) =>
      route.fulfill({
        status: 500,
        json: { statusCode: 500, code: 'INTERNAL', message: 'boom' },
      }),
    );
    await page.goto('/');

    await page.getByText('Ana').click();
    await page.getByText('Mi Biblioteca').click();
    await page.getByText(BOOK_TITLE).click();
    await page.getByText('Descargar EPUB').click();

    await expect(page.getByText('No pudimos generar el EPUB.')).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('boom')).not.toBeVisible();
  });
});
