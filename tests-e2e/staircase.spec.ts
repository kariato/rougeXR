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
  await expect(page.locator('#hud-message')).toContainText('You descended to level 2.');
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-spatial-status', /Level 2/);
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-spatial-message', /You descended to level 2/);
  await page.locator('#dungeon-3d').screenshot({ path: `test-results/spatial-status-${test.info().project.name}.png` });
  expect(errors).toEqual([]);
});

test('shows upward stairs and automatically returns with the Amulet', async ({ page }) => {
  await page.goto('/'); await page.locator('#tools-toggle').click();
  const save = await page.evaluate(async () => {
    const { createTwoRoomFixture } = await import('/src/debug/fixtures.ts');
    const { GameSession } = await import('/src/engine/session.ts');
    const { serializeSave } = await import('/src/persistence/save.ts');
    const { allocateId } = await import('/src/engine/entities.ts');
    const state = createTwoRoomFixture(); state.level.depth = 2; state.sourceState.maximumDepth = 2;
    state.player.at = { x: 23, y: 5 }; state.player.roomId = 1;
    state.level.monsterOrder = []; delete state.entities.e1;
    const id = allocateId(state);
    state.entities[id] = { kind: 'item', id, definitionId: 'amulet.yendor', category: 'amulet',
      location: { kind: 'pack', owner: 'player' }, quantity: 1, flags: 0, group: 0, label: null };
    state.player.packOrder.push(id);
    return serializeSave(new GameSession(state).exportState());
  });
  await page.locator('#load-file').setInputFiles({ name: 'ascent.json', mimeType: 'application/json', buffer: Buffer.from(save) });
  await expect(page.locator('#context-prompt')).toContainText('Spiral stairs up');
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-spatial-status', /Amulet: return upstairs/);
  await page.locator('h1').click(); await page.keyboard.press('d'); await page.keyboard.press('d');
  await expect(page.locator('#hud-depth')).toHaveText('1');
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-spatial-message', /You ascended to level 1/);
});
