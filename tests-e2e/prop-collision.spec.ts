import { expect, test } from '@playwright/test';
test('solid props stop player movement in 3D, including opened chests', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/'); await page.locator('#welcome-new').click();
  for (const kind of ['crate', 'rubble', 'pillar', 'urn', 'mushroom']) {
    const json = await page.evaluate(async kind => {
      const { createTwoRoomFixture } = await import('/src/debug/fixtures.ts');
      const { GameSession } = await import('/src/engine/session.ts');
      const { serializeSave } = await import('/src/persistence/save.ts');
      const state = createTwoRoomFixture(); state.level.monsterOrder = []; delete state.entities.e1;
      state.level.rooms[0]!.design.decorations.push({ id: 'obstacle', kind, at: { x: 6, y: 5 }, rotation: 0, variant: 0, scale: 1 });
      return serializeSave(new GameSession(state).exportState());
    }, kind);
    await page.locator('#load-file').setInputFiles({ name: 'prop.json', mimeType: 'application/json', buffer: Buffer.from(json) });
    await page.locator('h1').click(); await page.keyboard.press('l');
    await expect(page.locator('#state-summary')).toContainText('Revision 1');
    await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-player-at', '5,5');
    await page.keyboard.press('u'); // NE diagonal past the same obstacle
    await expect(page.locator('#state-summary')).toContainText('Revision 2');
    await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-player-at', '5,5');
    await page.keyboard.press('k'); // Clear northern tile
    await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-player-at', '5,4');
    if (kind === 'crate') {
      await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-open-chests', '1');
      await page.keyboard.press('j'); await page.keyboard.press('l');
      await expect(page.locator('#state-summary')).toContainText('Revision 5');
      await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-player-at', '5,5');
    }
  }
});
