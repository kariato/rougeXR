import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const key = 'rougexr.named-saves.v1';

test('stores JSON and restores the exact checkpoint after playing, a new game, and reload', async ({ page }) => {
  await page.goto('/'); await page.locator('#welcome-new').click(); await page.locator('#tools-toggle').click();
  await page.locator('#seed').fill('5150'); await page.locator('#new-game').click();
  await page.locator('#rest').click(); await expect(page.locator('#state-summary')).toContainText('Revision 1');
  await page.locator('#save-local').click(); await expect(page.locator('#hud-message')).toContainText('Game saved in this browser');
  const saved = await page.evaluate(key => localStorage.getItem(key), key);
  expect(JSON.parse(JSON.parse(saved!)[0].json).format).toBe('rougexr-save');
  await page.locator('#rest').click(); await expect(page.locator('#state-summary')).toContainText('Revision 2');
  await page.locator('#new-game').click();
  await page.reload(); await page.locator('#welcome-new').click(); await page.locator('#tools-toggle').click();
  await page.locator('#restore-local').click();
  await expect(page.locator('#hud-message')).toContainText('Restarted from your saved game');
  await expect(page.locator('#state-summary')).toContainText('Seed 5150 · Tick 1 · Revision 1');
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(saved);
  const download = page.waitForEvent('download'); await page.locator('#save').click();
  const file = await download;
  const restored = JSON.parse(await readFile((await file.path())!, 'utf8'));
  expect(restored.state).toEqual(JSON.parse(JSON.parse(saved!)[0].json).state);
});

test('handles missing or invalid checkpoints without replacing the current game', async ({ page }) => {
  await page.goto('/'); await page.locator('#welcome-new').click(); await page.locator('#tools-toggle').click(); await page.locator('#new-game').click();
  const before = await page.locator('#state-summary').textContent();
  await page.locator('#restore-local').click(); await expect(page.locator('#hud-message')).toContainText('No saved checkpoint');
  await page.evaluate(() => localStorage.setItem('rougexr.manual-save.v1', '{bad json'));
  await page.locator('#restore-local').click(); await expect(page.locator('#hud-message')).toContainText('invalid or incompatible');
  await expect(page.locator('#state-summary')).toHaveText(before!);
});

test('reports unavailable storage and keeps gameplay working', async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'rougexr.named-saves.v1') throw new DOMException('Storage is full', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await page.goto('/'); await page.locator('#welcome-new').click(); await page.locator('#tools-toggle').click(); await page.locator('#new-game').click();
  await page.locator('#save-local').click(); await expect(page.locator('#hud-message')).toContainText('Could not save game');
  await page.locator('#rest').click(); await expect(page.locator('#state-summary')).toContainText('Revision 1');
});


test('keeps named saves separate and updates a matching name', async ({ page }) => {
  await page.goto('/'); await page.locator('#welcome-new').click(); await page.locator('#tools-toggle').click(); await page.locator('#new-game').click();
  await page.locator('#save-name').fill('Before the stairs'); await page.locator('#save-local').click();
  await expect(page.locator('#hud-message')).toContainText('Before the stairs');
  await page.locator('#rest').click(); await expect(page.locator('#state-summary')).toContainText('Revision 1');
  await page.locator('#save-name').fill('After exploring'); await page.locator('#save-local').click();
  await expect(page.locator('#saved-games option')).toHaveCount(2);
  await page.locator('#saved-games').selectOption('Before the stairs'); await page.locator('#restore-local').click();
  await expect(page.locator('#state-summary')).toContainText('Revision 0');
  await page.locator('#saved-games').selectOption('After exploring'); await page.locator('#restore-local').click();
  await expect(page.locator('#state-summary')).toContainText('Revision 1');
  await page.locator('#rest').click(); await expect(page.locator('#state-summary')).toContainText('Revision 2');
  await page.locator('#save-local').click();
  await expect(page.locator('#hud-message')).toContainText('Game saved in this browser');
  await expect(page.locator('#saved-games option')).toHaveCount(2);
  const checkpoints = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key);
  expect(JSON.parse(checkpoints.find((entry: {name: string}) => entry.name === 'After exploring').json).state.timing.revision).toBe(2);
  await page.locator('#save-name').fill('   '); await page.locator('#save-local').click();
  await expect(page.locator('#hud-message')).toContainText('Enter a name');
  await expect(page.locator('#saved-games option')).toHaveCount(2);
});
