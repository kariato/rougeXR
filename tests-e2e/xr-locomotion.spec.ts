import { expect, test, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { installXrRuntime } from './xr-runtime';

test.beforeEach(async ({ page }) => { await installXrRuntime(page); });

async function startRoom(page: Page): Promise<void> {
  await page.goto('/'); await page.locator('#welcome-new').click();
  const save = await page.evaluate(async () => {
    const { createTwoRoomFixture } = await import('/src/debug/fixtures.ts');
    const { GameSession } = await import('/src/engine/session.ts');
    const { serializeSave } = await import('/src/persistence/save.ts');
    return serializeSave(new GameSession(createTwoRoomFixture()).exportState());
  });
  await page.locator('#load-file').setInputFiles({ name: 'room.json', mimeType: 'application/json', buffer: Buffer.from(save) });
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-player-at', '5,5');
  await page.locator('#xr-toggle').click();
  await expect(page.locator('#xr-toggle')).toHaveText('Exit XR');
  await page.evaluate(() => (window as any).xrTest.session.connectController());
  await expect.poll(() => page.evaluate(() => (window as any).xrTest.frames)).toBeGreaterThan(2);
}

async function select(page: Page, x: number, y: number): Promise<void> {
  const frame = await page.evaluate(({ x, y }) => {
    const runtime = (window as any).xrTest; runtime.aimX = x; runtime.aimY = y; runtime.aimZ = -1.3; return runtime.frames;
  }, { x, y });
  await expect.poll(() => page.evaluate(() => (window as any).xrTest.frames)).toBeGreaterThan(frame);
  await page.evaluate(() => (window as any).xrTest.session.select());
}

async function moveAndCapture(page: Page): Promise<Array<{ left: number; right: number }>> {
  const frame = await page.evaluate(() => {
    const runtime = (window as any).xrTest; runtime.aimX = 0; runtime.aimY = 0; runtime.aimZ = -1;
    return runtime.frames;
  });
  await expect.poll(() => page.evaluate(() => (window as any).xrTest.frames)).toBeGreaterThan(frame);
  await page.evaluate(() => {
    const runtime = (window as any).xrTest; runtime.trace = []; runtime.capture = true; runtime.session.squeeze();
    runtime.trackingX = .05; // Physical head movement remains independent of the visual grid transition.
  });
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-player-at', '5,4');
  await expect(page.locator('#state-summary')).toContainText('Revision 1');
  await expect.poll(() => page.evaluate(() => (window as any).xrTest.trace.length)).toBeGreaterThanOrEqual(24);
  return page.evaluate(() => { const runtime = (window as any).xrTest; runtime.capture = false; return runtime.trace; });
}

test('Comfort fades both eyes for one grid move and returns to a visible room', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await startRoom(page);
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-movement-mode', 'comfort');
  const trace = await moveAndCapture(page);
  expect(trace.some(frame => frame.left < 10 && frame.right < 10)).toBe(true);
  expect(trace.at(-1)!.left).toBeGreaterThan(100); expect(trace.at(-1)!.right).toBeGreaterThan(100);
  await expect(page.locator('#state-summary')).toContainText('Revision 1');
  await page.locator('#xr-toggle').click(); expect(errors).toEqual([]);
});

for (const vignette of [true, false]) test(`Glide keeps both eye centers visible with vignette ${vignette}`, async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(({ vignette }) => localStorage.setItem('rougexr.locomotion.v1', JSON.stringify({ movement: 'glide', vignette })), { vignette });
  await startRoom(page);
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-movement-mode', 'glide');
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-comfort-vignette', String(vignette));
  const trace = await moveAndCapture(page);
  expect(trace.every(frame => frame.left > 100 && frame.right > 100)).toBe(true);
  await expect(page.locator('#state-summary')).toContainText('Revision 1');
  await page.locator('#xr-toggle').click(); expect(errors).toEqual([]);
});

test('changes and persists locomotion preferences through tracked-controller menus', async ({ page }) => {
  test.setTimeout(60_000);
  await startRoom(page);
  await select(page, .49, -.48); await select(page, -.48, -.38); await select(page, 0, -.22);
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('aria-description', /MOVEMENT & COMFORT.*Comfort.*Glide.*vignette/s);
  await select(page, 0, .08); // Glide.
  await select(page, 0, -.12); // Disable its optional vignette.
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-movement-mode', 'glide');
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-comfort-vignette', 'false');
  const frame = await page.evaluate(() => (window as any).xrTest.frames);
  await expect.poll(() => page.evaluate(() => (window as any).xrTest.frames)).toBeGreaterThan(frame + 10);
  const image = await page.evaluate(() => (window as any).xrTest.image as string);
  await writeFile(`test-results/vr-movement-settings-${test.info().project.name}.png`, Buffer.from(image.split(',')[1]!, 'base64'));
  await page.locator('#xr-toggle').click(); await page.reload(); await page.locator('#welcome-new').click();
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-movement-mode', 'glide');
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-comfort-vignette', 'false');
});
