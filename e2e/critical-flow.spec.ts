import { expect, test } from '@playwright/test';
import { mockBackend } from './helpers/mockBackend';

test.describe('critical flow (SPEC-018)', () => {
  test('wizard generates a book and reaches the reader', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/');

    await page.getByText('Ana').click();
    await expect(page.getByText('¿Qué quieres hacer hoy?')).toBeVisible();

    await page.getByText('Crear Cuento').click();
    await expect(page.getByText('Elige tu Protagonista')).toBeVisible();

    await page.getByText('Un dragón').click();
    await expect(page.getByText('Elige el Escenario')).toBeVisible();

    await page.getByText('Un bosque').click();
    await page.getByText('Una estrella').click();
    await page.getByText('Acuarela').click();

    await expect(
      page.getByText('La aventura del dragón'),
    ).toBeVisible({ timeout: 20_000 });
  });
});
