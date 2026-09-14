import { expect, test } from '@playwright/test';

test('loads the Blender hobgoblin and plays each exported clip', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/model-preview.html');
  await expect(page.locator('#status')).toContainText('5 exported animations');
  await expect(page.locator('#animation option')).toHaveText(['idle', 'move', 'attack', 'hurt', 'death']);
  for (const clip of ['move', 'attack', 'hurt', 'death', 'idle']) {
    await page.locator('#animation').selectOption(clip);
    await expect(page.locator('#animation')).toHaveValue(clip);
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  }
  expect(errors).toEqual([]);
});
