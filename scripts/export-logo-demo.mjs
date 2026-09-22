import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const demoUrl = process.env.FRAMEWAVE_DEMO_URL ?? 'http://127.0.0.1:5173/logo-reveal/';
const outputPath = resolve(process.argv[2] ?? 'assets/social/framewave-logo-reveal.mp4');
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto(demoUrl, { waitUntil: 'networkidle' });
  const exportButton = page.getByRole('button', { name: 'Export MP4' });
  await exportButton.waitFor();

  const downloadPromise = page.waitForEvent('download', { timeout: 120_000 });
  await exportButton.click();
  const download = await downloadPromise;

  if (pageErrors.length > 0) {
    throw new Error(`Demo reported browser errors: ${pageErrors.join(' | ')}`);
  }

  await mkdir(dirname(outputPath), { recursive: true });
  await download.saveAs(outputPath);
  console.log(`Saved ${outputPath}`);
} finally {
  await browser.close();
}
