import { expect, test } from '@playwright/test';
import { mockBackend } from './helpers/mockBackend';

test.describe('student entry without login (SPEC-024)', () => {
  test('lists profiles from the public endpoint', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/');

    await expect(page.getByText('¿Quién eres?')).toBeVisible();
    await page.getByText('Ana').click();
    await expect(page.getByText('¿Qué quieres hacer hoy?')).toBeVisible();
  });

  test('a failed generation leaves the spinner and shows a localized error', async ({
    page,
  }) => {
    await mockBackend(page);
    await page.route('**/api/v1/ai/books/generate', (route) =>
      route.fulfill({
        status: 500,
        json: { statusCode: 500, code: 'INTERNAL', message: 'boom' },
      }),
    );
    await page.goto('/');

    await page.getByText('Ana').click();
    await page.getByText('Crear Cuento').click();
    await page.getByText('Un dragón').click();
    await page.getByText('Un bosque').click();
    await page.getByText('Una estrella').click();
    await page.getByText('Acuarela').click();

    await expect(page.getByText('Creando tu historia...')).toBeVisible();
    await expect(page.getByText('Elige el Estilo Visual')).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByText('Ocurrió un error inesperado. Podés intentarlo otra vez.'),
    ).toBeVisible();
    await expect(page.getByText('boom')).not.toBeVisible();
  });
});
