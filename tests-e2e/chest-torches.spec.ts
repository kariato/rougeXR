import { expect, test } from '@playwright/test';

test('keeps the chest closed until clicked and open after a scene refresh', async ({ page }) => {
  const loaded = new Set<string>();
  const errors: Error[] = [];
  page.on('requestfinished', request => {
    if (request.url().includes('/assets/props/')) loaded.add(new URL(request.url()).pathname);
  });
  page.on('pageerror', error => errors.push(error));
  await page.goto('/'); await page.locator('#welcome-new').click();
  await page.locator('#tools-toggle').click();
  await page.locator('#seed').fill('12345');
  await page.locator('#new-game').click();
  await expect(page.locator('#dungeon-3d')).toBeVisible();
  await expect.poll(() => loaded.has('/assets/props/crate.glb'), { timeout: 20_000 }).toBe(true);
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-chest-animation', 'closed');
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-open-chests', '0');
  const goldBefore = Number(await page.locator('#hud-gold').textContent());
  await page.mouse.click(640, 500);
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-open-chests', '1');
  await expect(page.locator('#hud-message')).toContainText('Contents:');
  await expect.poll(async () => Number(await page.locator('#hud-gold').textContent())).toBeGreaterThan(goldBefore);
  await expect(page.locator('#messages')).toContainText('gold pieces. Added to your gold.');
  await expect(page.locator('#state-summary')).toContainText('Revision 1');
  await page.locator('#rest').click();
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-open-chests', '1');
  await expect.poll(() => loaded.has('/assets/props/torch.glb'), { timeout: 20_000 }).toBe(true);
  expect(errors).toEqual([]);
});

test('walking beside a chest opens it and immediately awards its contents', async ({ page }) => {
  await page.goto('/'); await page.locator('#welcome-new').click();
  const json = await page.evaluate(async () => {
    const { createTwoRoomFixture } = await import('/src/debug/fixtures.ts');
    const { GameSession } = await import('/src/engine/session.ts');
    const { serializeSave } = await import('/src/persistence/save.ts');
    const state = createTwoRoomFixture(); state.level.monsterOrder = []; delete state.entities.e1;
    state.level.rooms[0]!.design.decorations.push({ id: 'auto-chest', kind: 'crate', at: { x: 6, y: 5 }, rotation: 0, variant: 0, scale: 1 });
    return serializeSave(new GameSession(state).exportState());
  });
  await page.locator('#load-file').setInputFiles({ name: 'chest.json', mimeType: 'application/json', buffer: Buffer.from(json) });
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-open-chests', '0');
  await page.locator('h1').click(); await page.keyboard.press('k');
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-open-chests', '1');
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-spatial-message', /Contents:.*gold pieces/);
  expect(Number(await page.locator('#hud-gold').textContent())).toBeGreaterThan(0);
  await expect(page.locator('#state-summary')).toContainText('Tick 1 · Revision 1');
});
