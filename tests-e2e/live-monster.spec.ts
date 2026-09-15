import { expect, test } from '@playwright/test';

test('loads the visible Kestrel model into live first-person gameplay', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('#tools-toggle').click();
  await page.locator('#world-mode').selectOption('kestrel');
  const response = page.waitForResponse(value => value.url().endsWith('/assets/creatures/kestrel.glb') && value.ok());
  await page.locator('#new-game').click();
  await response;
  await expect(page.locator('#dungeon-3d')).toBeVisible();
  await expect(page.locator('#state-summary')).toContainText('playing');
  expect(errors).toEqual([]);
});
