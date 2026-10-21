import { expect, test, type Page } from '@playwright/test';
import { installXrRuntime } from './xr-runtime';

async function frameAfter(page: Page, update: string): Promise<void> {
  const frame = await page.evaluate(update => {
    const runtime = (window as any).xrTest;
    new Function('runtime', update)(runtime);
    return runtime.frames;
  }, update);
  await expect.poll(() => page.evaluate(() => (window as any).xrTest.frames)).toBeGreaterThan(frame + 1);
}
async function start(page: Page, trackedY = 0): Promise<void> {
  await installXrRuntime(page); await page.goto('/'); await page.locator('#welcome-new').click();
  const save = await page.evaluate(async () => {
    const { createTwoRoomFixture } = await import('/src/debug/fixtures.ts');
    const { GameSession } = await import('/src/engine/session.ts');
    const { serializeSave } = await import('/src/persistence/save.ts');
    return serializeSave(new GameSession(createTwoRoomFixture()).exportState());
  });
  await page.locator('#load-file').setInputFiles({ name: 'room.json', mimeType: 'application/json', buffer: Buffer.from(save) });
  await page.evaluate(y => { (window as any).xrTest.trackingY = y; }, trackedY);
  await page.locator('#xr-toggle').click(); await expect(page.locator('#xr-toggle')).toHaveText('Exit XR');
}
for (const trackedY of [0, 1.6]) test(`adult eye height with local origin ${trackedY}, preserving crouching and physical scale`, async ({ page }) => {
  await start(page, trackedY);
  const canvas = page.locator('#dungeon-3d');
  await expect(canvas).toHaveAttribute('data-xr-eye-height', '1.65');
  await expect(canvas).toHaveAttribute('data-xr-metres-per-tile', '1.5');
  await frameAfter(page, `runtime.trackingY = ${trackedY - .3};`);
  expect(Number(await canvas.getAttribute('data-xr-eye-height'))).toBeCloseTo(1.35);
  await expect(page.locator('#state-summary')).toContainText('Revision 0');
  await expect.poll(() => page.evaluate(() => (window as any).xrTest.leftPixels)).toBeGreaterThan(100);
  await expect.poll(() => page.evaluate(() => (window as any).xrTest.rightPixels)).toBeGreaterThan(100);
  await page.locator('#xr-toggle').click(); await page.locator('#xr-toggle').click();
  await expect(canvas).toHaveAttribute('data-xr-eye-height', '1.65');
  await page.locator('#xr-toggle').click();
});
for (const hand of ['left', 'right']) test(`${hand} Quest-style thumbstick moves and snap turns without accidental repeat turns`, async ({ page }) => {
  test.setTimeout(60_000);
  await start(page);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await frameAfter(page, `runtime.session.connectController('${hand}');`);
  await frameAfter(page, 'runtime.session.inputSources[0].gamepad.axes = [0, 0, 1, 0];');
  const canvas = page.locator('#dungeon-3d');
  await expect(canvas).toHaveAttribute('data-pov-direction', 'NE');
  await page.waitForTimeout(600); await expect(canvas).toHaveAttribute('data-pov-direction', 'NE');
  await expect(page.locator('#state-summary')).toContainText('Revision 0');
  await frameAfter(page, 'runtime.session.inputSources[0].gamepad.axes = [0, 0, 0, 0];');
  await frameAfter(page, 'runtime.session.pulseStick([0, 0, 0, -1]);');
  // A native-frame pulse releases after one input frame even on a slow software renderer.
  await frameAfter(page, 'runtime.session.inputSources[0].gamepad.axes = [0, 0, 0, 0];');
  await expect(canvas).toHaveAttribute('data-player-at', '6,4');
  await expect(page.locator('#state-summary')).toContainText('Revision 1');
  await frameAfter(page, 'runtime.session.pulseStick([0, 0, 0, 1]);');
  await frameAfter(page, 'runtime.session.inputSources[0].gamepad.axes = [0, 0, 0, 0];');
  await expect(canvas).toHaveAttribute('data-player-at', '5,5');
  await expect(page.locator('#state-summary')).toContainText('Revision 2');
  // A paused/system-overlay session must require centring before the stick acts again.
  await frameAfter(page, "runtime.session.visibilityState = 'visible-blurred'; runtime.session.dispatchEvent(new Event('visibilitychange')); runtime.session.inputSources[0].gamepad.axes = [0, 0, 1, 0];");
  await frameAfter(page, "runtime.session.visibilityState = 'visible'; runtime.session.dispatchEvent(new Event('visibilitychange'));");
  await expect(canvas).toHaveAttribute('data-pov-direction', 'NE');
  await frameAfter(page, 'runtime.session.inputSources[0].gamepad.axes = [0, 0, 0, 0];');
  await frameAfter(page, 'runtime.session.inputSources[0].gamepad.axes = [0, 0, -1, 0];');
  await expect(canvas).toHaveAttribute('data-pov-direction', 'N');
  await page.locator('#xr-toggle').click(); expect(errors).toEqual([]);
});
