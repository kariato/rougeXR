import { expect, test } from '@playwright/test';

test('creates gameplay audio, avoids repeats, and remembers mute preference', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const original = AudioContext.prototype.createOscillator;
    (window as any).audioTones = 0;
    AudioContext.prototype.createOscillator = function () {
      (window as any).audioTones++; return original.call(this);
    };
  });
  await page.goto('/'); await page.locator('#welcome-new').click(); await page.locator('#tools-toggle').click();
  await page.locator('#world-mode').selectOption('kestrel'); await page.locator('#new-game').click();
  await page.locator('h1').click(); await page.keyboard.press('d');
  await expect(page.locator('#state-summary')).toContainText('Revision 1');
  await expect.poll(() => page.evaluate(() => (window as any).audioTones)).toBeGreaterThan(0);
  const tones = await page.evaluate(() => (window as any).audioTones);
  await page.locator('#event-filter').selectOption('messages');
  expect(await page.evaluate(() => (window as any).audioTones)).toBe(tones);
  await page.locator('#sound-toggle').click(); await expect(page.locator('#sound-toggle')).toHaveText('Sound: Off');
  await page.locator('h1').click(); await page.keyboard.press('d');
  await expect(page.locator('#state-summary')).toContainText('Revision 2');
  expect(await page.evaluate(() => (window as any).audioTones)).toBe(tones);
  await page.reload(); await page.locator('#welcome-new').click(); await expect(page.locator('#sound-toggle')).toHaveText('Sound: Off');
  expect(errors).toEqual([]);
});
