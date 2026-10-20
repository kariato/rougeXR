import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { installXrRuntime } from './xr-runtime';
import { selectView } from './ui-helpers';

test.beforeEach(async ({ page }) => { await installXrRuntime(page); });

test('renders visible dungeon pixels in both XR eyes on a phone with local-only tracking', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/'); await page.locator('#welcome-new').click();
  const before = await page.locator('#state-summary').textContent();
  await expect(page.locator('#xr-toggle')).toHaveText('Enter XR');
  await page.locator('#xr-toggle').click();
  await expect(page.locator('#xr-toggle')).toHaveText('Exit XR');
  await expect.poll(() => page.evaluate(() => (window as any).xrTest.leftPixels)).toBeGreaterThan(100);
  await expect.poll(() => page.evaluate(() => (window as any).xrTest.rightPixels)).toBeGreaterThan(100);
  expect(await page.evaluate(() => (window as any).xrTest.spaces)).toEqual(['local']);
  await page.evaluate(() => { (window as any).xrTest.trackingX = .12; (window as any).xrTest.trackingY = .05; });
  await page.setViewportSize({ width: 390, height: 844 }); // Resizing the mirror must not resize the native layer.
  await expect.poll(() => page.evaluate(() => (window as any).xrTest.rightPixels)).toBeGreaterThan(100);
  expect(await page.locator('#state-summary').textContent()).toBe(before);
  await expect.poll(() => page.evaluate(() => (window as any).xrTest.image)).not.toBe('');
  const data = await page.evaluate(() => (window as any).xrTest.image as string);
  await writeFile(`test-results/xr-stereo-${test.info().project.name}.png`, Buffer.from(data.split(',')[1]!, 'base64'));
  await page.evaluate(() => (window as any).xrTest.session.end()); // Headset/system exit.
  await expect(page.locator('#xr-toggle')).toHaveText('Enter XR');
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-xr-active', 'false');
  await page.locator('#xr-toggle').click();
  await expect(page.locator('#xr-toggle')).toHaveText('Exit XR');
  await expect.poll(() => page.evaluate(() => (window as any).xrTest.leftPixels)).toBeGreaterThan(100);
  await page.locator('#xr-toggle').click(); // Application exit.
  await expect(page.locator('#xr-toggle')).toHaveText('Enter XR');
  expect(errors).toEqual([]);
});

test('rolls back a failed renderer attachment instead of leaving a black immersive session', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await page.locator('#welcome-new').click();
  await page.evaluate(() => { (window as any).xrTest.rejectAttach = true; });
  await page.locator('#xr-toggle').click();
  await expect(page.locator('#xr-status')).toContainText('incompatible GPU');
  await expect(page.locator('#xr-toggle')).toHaveText('Enter XR');
  expect(await page.evaluate(() => (window as any).xrTest.ended)).toBe(1);
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-xr-active', 'false');
  await page.evaluate(() => { (window as any).xrTest.rejectAttach = false; });
  await page.locator('#xr-toggle').click();
  await expect(page.locator('#xr-toggle')).toHaveText('Exit XR');
  await expect.poll(() => page.evaluate(() => (window as any).xrTest.leftPixels)).toBeGreaterThan(100);
  await page.locator('#xr-toggle').click();
  expect(errors).toEqual([]);
});

test('enters XR from the map using the current adventure in the 3D renderer', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await page.locator('#welcome-new').click();
  await selectView(page, 'map');
  await page.locator('#xr-toggle').click();
  await expect(page.locator('#dungeon-3d')).toBeVisible();
  await expect(page.locator('#xr-toggle')).toHaveText('Exit XR');
  await expect.poll(() => page.evaluate(() => (window as any).xrTest.leftPixels)).toBeGreaterThan(100);
  await page.locator('#xr-toggle').click();
  expect(errors).toEqual([]);
});

test('a tracked controller ray opens the spatial menu and exits through VR settings', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await page.locator('#welcome-new').click();
  await page.locator('#xr-toggle').click();
  await expect(page.locator('#xr-toggle')).toHaveText('Exit XR');
  await page.evaluate(() => { (window as any).xrTest.session.connectController(); });
  const select = async (x: number, y: number) => {
    const frame = await page.evaluate(({ x, y }) => {
      const runtime = (window as any).xrTest; runtime.aimX = x; runtime.aimY = y; runtime.aimZ = -1.3; return runtime.frames;
    }, { x, y });
    await expect.poll(() => page.evaluate(() => (window as any).xrTest.frames)).toBeGreaterThan(frame);
    await page.evaluate(() => (window as any).xrTest.session.select());
  };
  await expect.poll(() => page.evaluate(() => (window as any).xrTest.frames)).toBeGreaterThan(1);
  await page.evaluate(() => (window as any).xrTest.session.squeeze());
  await expect(page.locator('#state-summary')).toContainText('Revision 1');
  await expect.poll(() => page.evaluate(() => (window as any).xrTest.leftPixels)).toBeGreaterThan(100);
  await select(.49, -.48); // Menu, reached from the tracked controller's world position.
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('aria-description', /Continue adventure/);
  await expect(page.locator('#state-summary')).toContainText('Revision 1');
  await select(-.48, -.38); // Settings.
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('aria-description', /Exit VR/);
  await select(0, -.56); // Exit VR without using the browser controls.
  await expect(page.locator('#xr-toggle')).toHaveText('Enter XR');
  expect(errors).toEqual([]);
});
