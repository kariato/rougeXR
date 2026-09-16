import { expect, test } from '@playwright/test';

test('loads the visible treasure chest and wall torch in generated first-person play', async ({ page }) => {
  const loaded = new Set<string>();
  const errors: Error[] = [];
  page.on('requestfinished', request => {
    if (request.url().includes('/assets/props/')) loaded.add(new URL(request.url()).pathname);
  });
  page.on('pageerror', error => errors.push(error));
  await page.goto('/');
  await page.locator('#tools-toggle').click();
  await page.locator('#seed').fill('12345');
  await page.locator('#new-game').click();
  await expect(page.locator('#dungeon-3d')).toBeVisible();
  await expect.poll(() => loaded.has('/assets/props/crate.glb'), { timeout: 20_000 }).toBe(true);
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-chest-animation', 'open');
  await expect.poll(() => loaded.has('/assets/props/torch.glb'), { timeout: 20_000 }).toBe(true);
  expect(errors).toEqual([]);
});
