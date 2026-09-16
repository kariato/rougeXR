import { expect, test } from '@playwright/test';

test('loads a room-facing GLB doorway and keeps it open after crossing', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const assetResponses: number[] = [];
  const rogueResponses: number[] = [];
  page.on('response', response => { if (response.url().includes('/assets/props/door.glb')) assetResponses.push(response.status()); });
  page.on('response', response => { if (response.url().includes('/assets/creatures/rogue.glb')) rogueResponses.push(response.status()); });
  await page.goto('/'); await page.locator('#tools-toggle').click();
  await page.locator('#world-mode').selectOption('rooms'); await page.locator('#new-game').click();
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-visible-doors', '1');
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-open-doors', '0');
  await page.locator('h1').click();
  for (let revision = 1; revision <= 6; revision++) {
    await page.keyboard.press('d');
    await expect(page.locator('#state-summary')).toContainText(`Revision ${revision}`);
  }
  // At first entry only the two perpendicular side walls may be inferred. The
  // undisclosed continuation ahead must remain open rather than becoming a cap.
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-corridor-walls', '2');
  await page.locator('#turn-angle').selectOption('90'); await page.locator('#turn-right').click();
  await page.waitForTimeout(250);
  await page.locator('#dungeon-3d').screenshot({ path: 'test-results/corridor-first-entry.png' });
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-open-doors', '1');
  await expect.poll(async () => Number(await page.locator('#dungeon-3d').getAttribute('data-corridor-walls'))).toBeGreaterThan(0);
  await page.waitForTimeout(900);
  await expect.poll(async () => Number(await page.locator('#dungeon-3d').getAttribute('data-door-swing'))).toBeLessThan(-1);
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-player-model', 'rogue');
  await page.locator('#view-mode').selectOption('2d'); await page.locator('#view-mode').selectOption('3d');
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-open-doors', '1');
  expect(assetResponses).toContain(200);
  expect(rogueResponses).toContain(200);
  expect(errors).toEqual([]);
});
