import { expect, test } from '@playwright/test';

const FILLER_HEIGHT_PX = 3000;

async function appendTallFiller(page: import('@playwright/test').Page) {
  await page.evaluate((height) => {
    const filler = document.createElement('div');
    filler.id = 'e2e-scroll-filler';
    filler.style.height = `${height}px`;
    document.body.appendChild(filler);
  }, FILLER_HEIGHT_PX);
}

test.describe('unblocked scroll (SPEC-012)', () => {
  test('body styles allow vertical panning', async ({ page }) => {
    await page.goto('/');

    const styles = await page.evaluate(() => {
      const body = getComputedStyle(document.body);

      return {
        overflowY: body.overflowY,
        touchAction: body.touchAction,
      };
    });

    expect(styles.overflowY).not.toBe('hidden');
    expect(styles.touchAction).toBe('pan-y');
  });

  test('desktop wheel scrolls the document', async ({ page }) => {
    await page.goto('/');
    await appendTallFiller(page);

    await page.mouse.move(200, 300);
    await page.mouse.wheel(0, 900);

    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(0);
  });

  test('desktop wheel scrolls a long inner list', async ({ page }) => {
    await page.goto('/');

    await page.evaluate(() => {
      const box = document.createElement('div');
      box.id = 'e2e-inner-scroll';
      box.style.cssText = 'height: 200px; overflow-y: auto;';

      const content = document.createElement('div');
      content.style.height = '2000px';
      box.appendChild(content);
      document.body.appendChild(box);
    });

    const inner = page.locator('#e2e-inner-scroll');
    await inner.hover();
    await page.mouse.wheel(0, 500);

    await expect
      .poll(() => inner.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0);
  });

  test('mobile touch pan scrolls the document', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'touch pan only runs on the mobile project');

    await page.goto('/');
    await appendTallFiller(page);

    const client = await page.context().newCDPSession(page);

    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: 200, y: 620 }],
    });

    for (const y of [540, 460, 380, 300, 220]) {
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: 200, y }],
      });
    }

    await client.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });

    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(0);
  });

  test('no horizontal scrollbar appears', async ({ page }) => {
    await page.goto('/');

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );

    expect(hasHorizontalOverflow).toBe(false);
  });
});
