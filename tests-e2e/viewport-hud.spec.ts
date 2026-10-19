import { selectView, toggleTools } from './ui-helpers';
import { expect, test } from '@playwright/test';

test('gives ordinary desktop play a dominant viewport and observation-backed HUD', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/'); await page.locator('#welcome-new').click();
  await expect(page.locator('#dungeon-3d')).toBeVisible();
  await expect(page.locator('#tools-panel')).toBeHidden();
  const metrics = await page.evaluate(() => {
    const box = document.querySelector('#view-host')!.getBoundingClientRect();
    return { area: box.width * box.height / (innerWidth * innerHeight), scroll: document.documentElement.scrollHeight > innerHeight };
  });
  expect(metrics.area).toBeGreaterThanOrEqual(0.7);
  expect(metrics.scroll).toBe(false);
  await expect(page.locator('#hud-hp')).toHaveText(/\d+\/\d+/);
  await expect(page.locator('#hud-depth')).toHaveText(/\d+/);
  await expect(page.locator('#crosshair')).toBeVisible();
  await selectView(page, 'map');
  await expect(page.locator('#crosshair')).toBeHidden();
  await selectView(page, 'firstPerson');
  await selectView(page, 'orbit');
  await expect(page.locator('#crosshair')).toBeHidden();
  await selectView(page, 'firstPerson');
  await expect(page.locator('#crosshair')).toBeVisible();
});

test('keeps tools reachable and phone actions usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/'); await page.locator('#welcome-new').click();
  await expect(page.locator('#tools-panel')).toBeHidden();
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(390);
  await expect(page.locator('.actions')).toBeHidden();
  const controls = await page.locator('.shell-toolbar').evaluate(element => ({ width: element.scrollWidth, viewport: innerWidth }));
  expect(controls.width).toBeLessThanOrEqual(controls.viewport);
  await toggleTools(page);
  await expect(page.locator('#tools-panel')).toBeVisible();
  await expect(page.locator('#tools-toggle')).toHaveAttribute('aria-expanded', 'true');
  await page.locator('#seed').focus();
  await page.keyboard.press('Escape');
  await expect(page.locator('#tools-panel')).toBeHidden();
  await expect(page.locator('.desktop-menu > summary')).toBeFocused();
});
