import { expect, test } from '@playwright/test';

const demos = [
  { name: 'Kinetic typography', path: '/kinetic-typography/' },
  { name: 'Audio visualizer', path: '/audio-visualizer/' },
  { name: 'Logo reveal', path: '/logo-reveal/' },
  { name: 'Product promo', path: '/motivd-promo/' },
];

test('demo gallery is readable and has no horizontal overflow', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Motion,');
  await expect(page.getByRole('heading', { name: 'Choose a composition' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'View on GitHub' })).toHaveAttribute(
    'href',
    'https://github.com/VFitter/framewave',
  );

  for (const demo of demos) {
    await expect(page.getByRole('link', { name: new RegExp(demo.name, 'i') })).toHaveAttribute(
      'href',
      `.${demo.path}`,
    );
  }

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});

for (const demo of demos) {
  test(`${demo.name} opens as a working composition`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });

    await page.goto(demo.path);
    await expect(page.locator('canvas')).toBeVisible();
    await expect.poll(() => page.locator('canvas').evaluate((canvas) => canvas.width)).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });
}
