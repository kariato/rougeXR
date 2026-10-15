import { expect, test } from '@playwright/test';
async function click3d(page: import('@playwright/test').Page, x: number, y: number, distance = 1.3) {
  const box = (await page.locator('#dungeon-3d').boundingBox())!;
  const half = distance * Math.tan(34 * Math.PI / 180);
  await page.locator('#dungeon-3d').click({ position: { x: (x / (half * box.width / box.height) + 1) * box.width / 2, y: (1 - y / half) * box.height / 2 } });
}
test('shows effect icons and selectable explanations including known cursed equipment', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await page.locator('#welcome-new').click(); await page.locator('#tools-toggle').click();
  const save = await page.evaluate(async () => {
    const { createNewGame } = await import('/src/engine/new-game.ts');
    const { GameSession } = await import('/src/engine/session.ts');
    const { serializeSave } = await import('/src/persistence/save.ts');
    const { IS_BLIND, IS_CONFUSED, IS_HELD, IS_CURSED } = await import('/src/engine/rules/flags.ts');
    const state = createNewGame(12345);
    state.player.flags |= IS_BLIND | IS_CONFUSED | IS_HELD; state.player.stats.strength = 14; state.player.poisonWeakened = true;
    state.timing.hungerStage = 2;
    const weapon = state.entities[state.player.equipment.weapon!]!; weapon.flags |= IS_CURSED; weapon.curseKnown = true;
    return serializeSave(new GameSession(state).exportState());
  });
  await page.locator('#load-file').setInputFiles({ name: 'effects.json', mimeType: 'application/json', buffer: Buffer.from(save) });
  const canvas = page.locator('#dungeon-3d');
  await expect(canvas).toHaveAttribute('data-status-effects', /Poison weakened/);
  await expect(canvas).toHaveAttribute('data-status-effects', /Cursed equipment/);
  await page.locator('#tools-toggle').click();
  await canvas.screenshot({ path: `test-results/status-badges-${test.info().project.name}.png` });
  await click3d(page, 0, .535, 1.25);
  await expect(canvas).toHaveAttribute('aria-description', /movement may go in a random direction/);
  await canvas.screenshot({ path: `test-results/status-explanations-${test.info().project.name}.png` });
  await click3d(page, .48, -.47);
  await expect(canvas).toHaveAttribute('aria-description', /Remove curse magic/);
  expect(errors).toEqual([]);
});
