import { expect, test } from '@playwright/test';

test('marks a disclosed corridor end with distinct masonry', async ({ page }) => {
  await page.goto('/'); await page.locator('#tools-toggle').click();
  const save = await page.evaluate(async () => {
    const { createTwoRoomFixture } = await import('/src/debug/fixtures.ts');
    const { GameSession } = await import('/src/engine/session.ts');
    const { serializeSave } = await import('/src/persistence/save.ts');
    const state = createTwoRoomFixture();
    state.player.at = { x: 18, y: 5 }; state.player.roomId = null;
    state.level.tiles[5 * state.level.width + 20]!.terrain = 'void';
    state.knowledge.remembered.fill(null);
    return serializeSave(new GameSession(state).exportState());
  });
  await page.locator('#load-file').setInputFiles({ name: 'dead-end.json', mimeType: 'application/json', buffer: Buffer.from(save) });
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-dead-end-walls', '1');
  await page.locator('#turn-right').click();
  await page.waitForTimeout(400);
  await page.locator('#dungeon-3d').screenshot({ path: `test-results/dead-end-${test.info().project.name}.png` });
  const distinct = await page.evaluate(async () => {
    const { RoomMaterialCatalog } = await import('/src/presentation/three/room-materials.ts');
    const catalog = new RoomMaterialCatalog();
    const end = catalog.material('dungeon', 'deadEnd', 0, false, false, 1, 1);
    const wall = catalog.material('dungeon', 'wall', 0, false, false, 1, 1);
    const a = (end.map!.image as HTMLCanvasElement).toDataURL();
    const b = (wall.map!.image as HTMLCanvasElement).toDataURL();
    catalog.dispose(); return a !== b;
  });
  expect(distinct).toBe(true);
});
