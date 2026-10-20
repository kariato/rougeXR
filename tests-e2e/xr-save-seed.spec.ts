import { expect, test, type Page } from '@playwright/test';
import { installXrRuntime } from './xr-runtime';

async function select(page: Page, x: number, y: number): Promise<void> {
  const frame = await page.evaluate(({ x, y }) => {
    const runtime = (window as any).xrTest;
    runtime.aimX = x; runtime.aimY = y; runtime.aimZ = -1.3;
    return runtime.frames;
  }, { x, y });
  await expect.poll(() => page.evaluate(() => (window as any).xrTest.frames)).toBeGreaterThan(frame);
  await page.evaluate(() => (window as any).xrTest.session.select());
}

test('saves with visible confirmation and chooses a random seed through an XR controller', async ({ page }) => {
  test.setTimeout(60_000);
  await installXrRuntime(page);
  await page.goto('/'); await page.locator('#welcome-seed').fill('43210'); await page.locator('#welcome-new').click();
  await page.locator('#xr-toggle').click(); await expect(page.locator('#xr-toggle')).toHaveText('Exit XR');
  await page.evaluate(() => (window as any).xrTest.session.connectController());
  await select(page, .49, -.48); await select(page, -.36, .1); // Menu → Save
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('aria-description', /Saved .*seed 43210/);
  const saves = await page.evaluate(() => JSON.parse(localStorage.getItem('rougexr.named-saves.v1')!));
  expect(saves[0].name).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} · seed 43210/);
  await select(page, 0, -.59); await select(page, 0, -.4); // Restart → Random
  const labels = await page.locator('#dungeon-3d').getAttribute('aria-description');
  const seed = Number(labels!.match(/World seed: (\d+)/)![1]);
  expect(seed).not.toBe(43210);
  await select(page, -.36, 0);
  await expect(page.locator('#state-summary')).toContainText(`Seed ${seed} · Tick 0 · Revision 0`);
  await expect(page.locator('#xr-toggle')).toHaveText('Exit XR');
  await page.locator('#xr-toggle').click();
});
