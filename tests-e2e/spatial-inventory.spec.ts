import { clickSpatial as panelClick } from './ui-helpers';
import { desktopClick, toggleTools } from './ui-helpers';
import { expect, test } from '@playwright/test';

test('opens spatial inventory, selects food, eats it, and blocks movement while open', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await page.locator('#welcome-new').click(); await toggleTools(page); await desktopClick(page, '#new-game');
  await page.locator('h1').click(); await page.keyboard.press('i');
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-inventory-open', 'true');
  await page.keyboard.press('w');
  await expect(page.locator('#state-summary')).toContainText('Revision 0');
  await panelClick(page, 0, .36);
  await page.waitForTimeout(100);
  await page.locator('#dungeon-3d').screenshot({ path: `test-results/spatial-inventory-${test.info().project.name}.png` });
  await panelClick(page, -.54, -.44);
  await expect(page.locator('#state-summary')).toContainText('Revision 1');
  await expect(page.locator('#inventory')).not.toContainText('Food ration');
  await page.locator('h1').click(); await page.keyboard.press('i');
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-inventory-open', 'false');
  // The rendered Inventory button also opens the panel without a game turn.
  await panelClick(page, -.49, -.48);
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-inventory-open', 'true');
  await expect(page.locator('#state-summary')).toContainText('Revision 1');
  expect(errors).toEqual([]);
});

test('death desaturates the viewport and displays DEAD', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await page.locator('#welcome-new').click(); await toggleTools(page);
  const save = await page.evaluate(async () => {
    const { createTwoRoomFixture } = await import('/src/debug/fixtures.ts');
    const { GameSession } = await import('/src/engine/session.ts');
    const { serializeSave } = await import('/src/persistence/save.ts');
    const state = new GameSession(createTwoRoomFixture()).exportState();
    state.player.stats.hp = 0; state.timing.status = 'dead'; state.timing.cycle = { phase: 'terminal', slotsRemaining: 0 };
    return serializeSave(state);
  });
  await page.locator('#load-file').setInputFiles({ name: 'dead.json', mimeType: 'application/json', buffer: Buffer.from(save) });
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-dead', 'true');
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('aria-label', /DEAD.*An unknown dungeon danger.*Depth 1/);
  await expect(page.locator('#dungeon-3d')).toHaveCSS('filter', 'grayscale(1)');
  await page.locator('#dungeon-3d').screenshot({ path: `test-results/dead-screen-${test.info().project.name}.png` });
  await toggleTools(page);
  await desktopClick(page, '#new-game');
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-dead', 'false');
  await expect(page.locator('#dungeon-3d')).toHaveCSS('filter', 'none');
  expect(errors).toEqual([]);
});
