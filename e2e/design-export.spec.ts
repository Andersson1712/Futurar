import { expect, test, type Page } from '@playwright/test';
import { mockBackend } from './helpers/mockBackend';

const DESIGN_TITLE = 'Mi fiesta de cumple';
const DESIGN_MESSAGE = 'Fiesta de cumple el sábado a las 17';

const COMPLETED_DESIGN_EXPORT_JOB = {
  id: 'design-export-job-1',
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
  pages: [{ pageNumber: 1, content: DESIGN_MESSAGE }],
};

const DESIGN_SUMMARY = {
  id: 'design-1',
  title: DESIGN_TITLE,
  occasion: 'birthday',
  version: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

async function mockDesignExport(page: Page): Promise<void> {
  await page.route('**/api/v1/designs**', (route) =>
    route.fulfill({ json: [DESIGN_SUMMARY] }),
  );
  await page.route('**/api/v1/designs/*', (route) =>
    route.fulfill({ json: DESIGN_DETAIL }),
  );
  await page.route('**/api/v1/exports/designs/*', (route) =>
    route.fulfill({
      status: 202,
      json: { jobId: 'design-export-job-1', status: 'queued' },
    }),
  );
  await page.route('**/api/v1/ai/jobs/design-export-job-1/events', (route) =>
    route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: `event: status\ndata: ${JSON.stringify(COMPLETED_DESIGN_EXPORT_JOB)}\n\n`,
    }),
  );
  await page.route('**/api/v1/exports/design-export-job-1/download', (route) =>
    route.fulfill({
      status: 200,
      json: { downloadUrl: '/api/v1/exports/design-export-job-1/file' },
    }),
  );
  await page.route('**/api/v1/exports/design-export-job-1/file', (route) =>
    route.fulfill({
      status: 200,
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': 'attachment; filename="flyer.pdf"',
      },
      body: 'fake-pdf-bytes',
    }),
  );
}

test.describe('design PDF export (SPEC-031B)', () => {
  test('downloads a server-built PDF from the details view', async ({
    page,
  }) => {
    await mockBackend(page);
    await mockDesignExport(page);
    await page.goto('/');

    await page.getByText('Ana').click();
    await page.getByText('Mi Biblioteca').click();
    await expect(page.getByText(DESIGN_TITLE)).toBeVisible();

    await page.getByText(DESIGN_TITLE).click();
    await expect(page.getByText('Descargar PDF')).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByText('Descargar PDF').click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  });

  test('a failed export shows a localized error and never exposes raw text', async ({
    page,
  }) => {
    await mockBackend(page);
    await mockDesignExport(page);
    await page.route('**/api/v1/exports/designs/*', (route) =>
      route.fulfill({
        status: 500,
        json: { statusCode: 500, code: 'INTERNAL', message: 'boom' },
      }),
    );
    await page.goto('/');

    await page.getByText('Ana').click();
    await page.getByText('Mi Biblioteca').click();
    await page.getByText(DESIGN_TITLE).click();
    await page.getByText('Descargar PDF').click();

    await expect(page.getByText('No pudimos generar el PDF del diseño.')).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('boom')).not.toBeVisible();
  });
});
