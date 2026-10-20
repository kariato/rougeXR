import { clickSpatial as click3d, openMenu } from './ui-helpers';
import { desktopClick, gameKey, toggleTools } from './ui-helpers';
import { expect, test } from '@playwright/test';
test('uses grouped in-world naming, save/load, settings and confirmed restart', async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await page.locator('#welcome-new').click();
  await openMenu(page);
  await click3d(page, 0, -.06); // Save name
  await click3d(page, .48, -.4); // Clear
  await click3d(page, -.6, .22); // A
  await click3d(page, -.36, .22); // B
  await click3d(page, -.36, -.52); // Done
  await expect(page.locator('#save-name')).toHaveValue('AB');
  await click3d(page, -.36, .1); // Save
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-spatial-message', /saved.*AB/);
  await click3d(page, -.48, -.38); // Settings
  await click3d(page, 0, .28); // Sound
  await expect(page.locator('#sound-toggle')).toHaveText('Sound: Off');
  await click3d(page, .36, -.06); // Volume up
  await expect(page.locator('#sound-volume')).toHaveValue('45');
  await click3d(page, -.52, .61); // Back
  await page.screenshot({ path: `test-results/spatial-menu-${test.info().project.name}.png` });
  await click3d(page, .52, .61); // Close
  await click3d(page, 0, -.48); // Actions
  await click3d(page, -.36, .28); // Search
  await expect(page.locator('#state-summary')).toContainText('Revision 1');
  await openMenu(page); await click3d(page, .36, .1); await click3d(page, 0, .34); // Load AB
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-spatial-message', /Restarted.*AB/);
  await expect(page.locator('#state-summary')).toContainText('Revision 0');
  await gameKey(page, '.'); await expect(page.locator('#state-summary')).toContainText('Revision 1');
  await openMenu(page); await click3d(page, 0, -.59); // Restart confirmation
  await expect(page.locator('#state-summary')).toContainText('Revision 1');
  await click3d(page, -.36, 0); // Confirm
  await expect(page.locator('#state-summary')).toContainText('Revision 0');
  expect(errors).toEqual([]);
});

test('keeps the spatial menu accessible after death', async ({ page }) => {
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
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-inventory-open', 'true');
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('aria-description', /DEAD.*Restart.*Load Save/s);
  await click3d(page, -.36, -.34); // Restart from the results panel
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-dead', 'false');
});

test('shows save confirmation in the open menu and lets VR players enter a seed', async ({ page }) => {
  await page.goto('/'); await page.locator('#welcome-new').click(); await openMenu(page);
  await click3d(page, -.36, .1);
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('aria-description', /Saved \d{4}-.*seed 12345/);
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-inventory-open', 'true');
  await click3d(page, 0, -.59); await click3d(page, 0, -.2); // Restart → seed keypad
  await click3d(page, .48, -.4); // Clear
  await click3d(page, -.48, .22); await click3d(page, 0, .22); // 12
  await click3d(page, -.36, -.52); // Done
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('aria-description', /World seed: 12/);
  await click3d(page, -.36, 0);
  await expect(page.locator('#state-summary')).toContainText('Seed 12 · Tick 0 · Revision 0');
});
