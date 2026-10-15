import { expect, test } from '@playwright/test';
async function click3d(page: import('@playwright/test').Page, x: number, y: number) {
  const box = (await page.locator('#dungeon-3d').boundingBox())!;
  const half = 1.3 * Math.tan(34 * Math.PI / 180), scale = Math.min(1, box.width / box.height * half / .83);
  await page.locator('#dungeon-3d').click({ position: { x: (x * scale / (half * box.width / box.height) + 1) * box.width / 2,
    y: (1 - y * scale / half) * box.height / 2 } });
}
async function openMenu(page: import('@playwright/test').Page) {
  await page.locator('h1').click(); await page.keyboard.press('m');
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-inventory-open', 'true');
}
test('uses in-world naming, save/load, search, sound and confirmed restart', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await page.locator('#new-game').click();
  await openMenu(page);
  await click3d(page, 0, .06); // Save name
  await click3d(page, .48, -.4); // Clear
  await click3d(page, -.6, .22); // A
  await click3d(page, -.36, .22); // B
  await click3d(page, -.36, -.52); // Done
  await expect(page.locator('#save-name')).toHaveValue('AB');
  await click3d(page, -.36, -.08); // Save
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-spatial-message', /saved.*AB/);
  await click3d(page, -.48, -.22); // Sound
  await expect(page.locator('#sound-toggle')).toHaveText('Sound: Off');
  await click3d(page, .48, -.22); // Volume up
  await expect(page.locator('#sound-volume')).toHaveValue('45');
  await page.locator('#dungeon-3d').screenshot({ path: `test-results/spatial-menu-${test.info().project.name}.png` });
  await click3d(page, -.36, .34); // Search
  await expect(page.locator('#state-summary')).toContainText('Revision 1');
  await openMenu(page); await click3d(page, .36, -.08); await click3d(page, 0, .34); // Load AB
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-spatial-message', /Restarted.*AB/);
  await expect(page.locator('#state-summary')).toContainText('Revision 0');
  await page.locator('#rest').click(); await expect(page.locator('#state-summary')).toContainText('Revision 1');
  await openMenu(page); await click3d(page, -.48, -.36); // Restart dialog
  await expect(page.locator('#state-summary')).toContainText('Revision 1');
  await click3d(page, -.36, 0); // Confirm
  await expect(page.locator('#state-summary')).toContainText('Revision 0');
  expect(errors).toEqual([]);
});

test('keeps the spatial menu accessible after death', async ({ page }) => {
  await page.goto('/'); await page.locator('#tools-toggle').click();
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
  await click3d(page, .53, -.48); // Menu button
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-inventory-open', 'true');
  await click3d(page, -.48, -.36); await click3d(page, -.36, 0); // Restart and confirm
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-dead', 'false');
});
