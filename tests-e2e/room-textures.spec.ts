import { toggleTools } from './ui-helpers';
import { expect, test } from '@playwright/test';

test('produces distinct deterministic room-family textures in a browser', async ({ page }) => {
  await page.goto('/'); await page.locator('#welcome-new').click();
  const result = await page.evaluate(async () => {
    const { RoomMaterialCatalog, surfaceVariant } = await import('/src/presentation/three/room-materials.ts');
    const catalog = new RoomMaterialCatalog();
    const themes = ['dungeon', 'cave', 'crypt', 'store', 'treasure'] as const;
    const signatures = themes.map(theme => {
      const material = catalog.material(theme, 'floor', 0, false, false, 5, 7);
      const canvas = material.map?.image as HTMLCanvasElement;
      const pixels = canvas.getContext('2d')!.getImageData(0, 0, 128, 128).data;
      let checksum = 2166136261;
      for (let index = 0; index < pixels.length; index += 4) checksum = Math.imul(checksum ^ pixels[index]!, 16777619);
      return checksum >>> 0;
    });
    const left = catalog.material('dungeon', 'floor', 0, false, false, 0, 0);
    const right = catalog.material('dungeon', 'floor', 0, false, false, 1, 0);
    const seamless = left.map === right.map && left.bumpMap === left.map;
    const repeated = surfaceVariant('store', 'wall', 11, 4) === surfaceVariant('store', 'wall', 11, 4);
    catalog.dispose();
    return { signatures, repeated, seamless };
  });
  expect(new Set(result.signatures).size).toBe(5);
  expect(result.repeated).toBe(true);
  expect(result.seamless).toBe(true);
});


test('renders a continuous cobblestone floor in first person', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await page.locator('#welcome-new').click(); await toggleTools(page);
  const save = await page.evaluate(async () => {
    const { createTwoRoomFixture } = await import('/src/debug/fixtures.ts');
    const { GameSession } = await import('/src/engine/session.ts');
    const { serializeSave } = await import('/src/persistence/save.ts');
    const state = createTwoRoomFixture();
    for (const room of state.level.rooms) { room.design.theme = 'dungeon'; room.design.baseTheme = 'dungeon'; }
    return serializeSave(new GameSession(state).exportState());
  });
  await page.locator('#load-file').setInputFiles({ name: 'cobbles.json', mimeType: 'application/json', buffer: Buffer.from(save) });
  await expect(page.locator('#save-status')).toContainText('Loaded');
  await toggleTools(page);
  await page.locator('#dungeon-3d').screenshot({ path: `test-results/cobblestone-${test.info().project.name}.png` });
  expect(errors).toEqual([]);
});
