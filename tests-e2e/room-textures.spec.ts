import { expect, test } from '@playwright/test';

test('produces distinct deterministic room-family textures in a browser', async ({ page }) => {
  await page.goto('/');
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
    const repeated = surfaceVariant('store', 'wall', 11, 4) === surfaceVariant('store', 'wall', 11, 4);
    catalog.dispose();
    return { signatures, repeated };
  });
  expect(new Set(result.signatures).size).toBe(5);
  expect(result.repeated).toBe(true);
});
