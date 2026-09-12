import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('starts without WebXR and protects focused controls from gameplay input', async ({ page }) => {
  const errors: Error[] = []; page.on('pageerror', error => errors.push(error));
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'xr', { configurable: true, get: () => undefined }));
  await page.goto('/');
  await expect(page.locator('#dungeon')).toBeVisible();
  expect(await page.evaluate(() => (navigator as Navigator & { xr?: unknown }).xr === undefined)).toBe(true);
  await page.locator('#seed').fill('4242'); await page.locator('#new-game').click();
  await expect(page.locator('#state-summary')).toContainText('Seed 4242 · Tick 0 · Revision 0');
  await page.locator('#seed').press('w');
  await expect(page.locator('#state-summary')).toContainText('Revision 0');
  await page.locator('h1').click(); await page.keyboard.press('.');
  await expect(page.locator('#state-summary')).toContainText('Revision 1');
  expect(errors).toEqual([]);
});

test('supports generated inventory plus manual save, load, and report export', async ({ page }) => {
  await page.goto('/');
  await page.locator('#seed').fill('5150'); await page.locator('#new-game').click();
  await expect(page.locator('#inventory')).toContainText('food.ration');

  const saveDownload = page.waitForEvent('download'); await page.locator('#save').click();
  const save = await saveDownload; const savePath = await save.path(); expect(savePath).not.toBeNull();
  await page.locator('#inventory button', { hasText: 'Drop' }).first().click();
  await expect(page.locator('#state-summary')).toContainText('Revision 1');
  await page.locator('#load-file').setInputFiles(savePath!);
  await expect(page.locator('#save-status')).toContainText('Loaded revision 0');
  await expect(page.locator('#inventory')).toContainText('food.ration');

  const reportDownload = page.waitForEvent('download'); await page.locator('#export-report').click();
  const report = await reportDownload; const reportPath = await report.path(); expect(reportPath).not.toBeNull();
  const bundle = JSON.parse(await readFile(reportPath!, 'utf8')) as { format: string; entries: unknown[] };
  expect(bundle).toMatchObject({ format: 'rougexr-replay', entries: [] });
});

test('keeps CSS-pixel hit testing correct after resize at devicePixelRatio 2', async ({ page }) => {
  await page.goto('/');
  await page.locator('#world-mode').selectOption('rooms'); await page.locator('#new-game').click();
  expect(await page.evaluate(() => devicePixelRatio)).toBe(2);
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1000, height: 640 }]) {
    await page.setViewportSize(viewport);
    const canvas = page.locator('#dungeon');
    await expect.poll(() => canvas.evaluate(element => {
      const bounds = element.getBoundingClientRect();
      return element.width === Math.round(Math.floor(bounds.width) * devicePixelRatio)
        && element.height === Math.round(Math.floor(bounds.height) * devicePixelRatio);
    })).toBe(true);
    const box = await canvas.boundingBox(); expect(box).not.toBeNull();
    const backing = await canvas.evaluate(element => ({ width: element.width, height: element.height, ratio: devicePixelRatio }));
    expect(backing.ratio).toBe(2);
    const cssWidth = backing.width / backing.ratio; const cssHeight = backing.height / backing.ratio;
    const cellSize = Math.max(1, Math.floor(Math.min(cssWidth / 80, cssHeight / 24)));
    const offsetX = Math.floor((cssWidth - 80 * cellSize) / 2); const offsetY = Math.floor((cssHeight - 24 * cellSize) / 2);
    await canvas.click({ position: { x: offsetX + 5.5 * cellSize, y: offsetY + 5.5 * cellSize } });
    await expect(page.locator('#inspector')).toContainText('Cell 5, 5'); await expect(page.locator('#inspector')).toContainText('Player');
  }
});
