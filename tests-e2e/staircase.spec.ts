import { expect, test } from '@playwright/test';

test('shows spiral stairs and descends when the player steps onto them', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await page.locator('#tools-toggle').click();
  const save = await page.evaluate(async () => {
    const { createTwoRoomFixture } = await import('/src/debug/fixtures.ts');
    const { GameSession } = await import('/src/engine/session.ts');
    const { serializeSave } = await import('/src/persistence/save.ts');
    const state = createTwoRoomFixture();
    state.player.at = { x: 23, y: 5 }; state.player.roomId = 1;
    state.level.monsterOrder = []; delete state.entities.e1;
    return serializeSave(new GameSession(state).exportState());
  });
  await page.locator('#load-file').setInputFiles({ name: 'stairs.json', mimeType: 'application/json', buffer: Buffer.from(save) });
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-visible-stairs', '1');
  await expect(page.locator('#context-prompt')).toContainText('Spiral stairs down');
  await page.locator('#turn-angle').selectOption('90'); await page.locator('#turn-right').click();
  await page.waitForTimeout(350);
  await page.locator('#dungeon-3d').screenshot({ path: `test-results/staircase-${test.info().project.name}.png` });
  await page.locator('h1').click(); await page.keyboard.press('d');
  await expect(page.locator('#hud-depth')).toHaveText('1');
  await page.keyboard.press('d');
  await expect(page.locator('#hud-depth')).toHaveText('2');
  expect(errors).toEqual([]);
});
