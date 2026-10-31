import { expect, test } from '@playwright/test';
import { desktopOptions, desktopClick, toggleTools } from './ui-helpers';

test('selects difficulty, toggles god mode, and restores both from a checkpoint', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('#welcome-difficulty').selectOption('hard');
  await page.locator('#welcome-new').click();
  await expect(page.locator('#welcome')).not.toBeVisible();
  await expect(page.locator('#hud-difficulty')).toHaveText('Hard');
  await toggleTools(page);
  await page.locator('#god-mode').click();
  await expect(page.locator('#god-mode')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#hud-difficulty')).toHaveText('Hard · GOD MODE');
  await desktopOptions(page);
  await page.locator('#save-name').fill('God debug');
  await desktopClick(page, '#save-local');
  await page.locator('#god-mode').click();
  await expect(page.locator('#hud-difficulty')).toHaveText('Hard');
  await desktopClick(page, '#restore-local');
  await expect(page.locator('#hud-difficulty')).toHaveText('Hard · GOD MODE');
  await expect(page.locator('#god-mode')).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});
