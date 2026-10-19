import { desktopClick, desktopFill, desktopOptions, gameKey, toggleTools } from './ui-helpers';
import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const key = 'rougexr.named-saves.v1';
test.describe.configure({ timeout: 60_000 });

test('stores JSON and restores the exact checkpoint after playing, a new game, and reload', async ({ page }) => {
  await page.goto('/'); await page.locator('#welcome-new').click(); await toggleTools(page);
  await page.locator('#seed').fill('5150'); await desktopClick(page, '#new-game');
  await gameKey(page, '.'); await expect(page.locator('#state-summary')).toContainText('Revision 1');
  await desktopClick(page, '#save-local'); await expect(page.locator('#hud-message')).toContainText('Game saved in this browser');
  const saved = await page.evaluate(key => localStorage.getItem(key), key);
  expect(JSON.parse(JSON.parse(saved!)[0].json).format).toBe('rougexr-save');
  await gameKey(page, '.'); await expect(page.locator('#state-summary')).toContainText('Revision 2');
  await desktopClick(page, '#new-game');
  await page.reload(); await page.locator('#welcome-new').click(); await toggleTools(page);
  await desktopClick(page, '#restore-local');
  await expect(page.locator('#hud-message')).toContainText('Restarted from your saved game');
  await expect(page.locator('#state-summary')).toContainText('Seed 5150 · Tick 1 · Revision 1');
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(saved);
  const download = page.waitForEvent('download'); await page.locator('#save').click();
  const file = await download;
  const restored = JSON.parse(await readFile((await file.path())!, 'utf8'));
  expect(restored.state).toEqual(JSON.parse(JSON.parse(saved!)[0].json).state);
});

test('handles missing or invalid checkpoints without replacing the current game', async ({ page }) => {
  await page.goto('/'); await page.locator('#welcome-new').click(); await toggleTools(page); await desktopClick(page, '#new-game');
  const before = await page.locator('#state-summary').textContent();
  await desktopClick(page, '#restore-local'); await expect(page.locator('#hud-message')).toContainText('No saved checkpoint');
  await page.evaluate(() => localStorage.setItem('rougexr.manual-save.v1', '{bad json'));
  await desktopClick(page, '#restore-local'); await expect(page.locator('#hud-message')).toContainText('invalid or incompatible');
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
  await page.goto('/'); await page.locator('#welcome-new').click(); await toggleTools(page); await desktopClick(page, '#new-game');
  await desktopClick(page, '#save-local'); await expect(page.locator('#hud-message')).toContainText('Could not save game');
  await gameKey(page, '.'); await expect(page.locator('#state-summary')).toContainText('Revision 1');
});


test('keeps named saves separate and updates a matching name', async ({ page }) => {
  await page.goto('/'); await page.locator('#welcome-new').click(); await toggleTools(page); await desktopClick(page, '#new-game');
  await desktopFill(page, '#save-name', 'Before the stairs'); await desktopClick(page, '#save-local');
  await expect(page.locator('#hud-message')).toContainText('Before the stairs');
  await gameKey(page, '.'); await expect(page.locator('#state-summary')).toContainText('Revision 1');
  await desktopFill(page, '#save-name', 'After exploring'); await desktopClick(page, '#save-local');
  await expect(page.locator('#saved-games option')).toHaveCount(2);
  await desktopOptions(page); await page.locator('#saved-games').selectOption('Before the stairs'); await desktopClick(page, '#restore-local');
  await expect(page.locator('#state-summary')).toContainText('Revision 0');
  await desktopOptions(page); await page.locator('#saved-games').selectOption('After exploring'); await desktopClick(page, '#restore-local');
  await expect(page.locator('#state-summary')).toContainText('Revision 1');
  await gameKey(page, '.'); await expect(page.locator('#state-summary')).toContainText('Revision 2');
  await desktopClick(page, '#save-local');
  await expect(page.locator('#hud-message')).toContainText('Game saved in this browser');
  await expect(page.locator('#saved-games option')).toHaveCount(2);
  const checkpoints = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key);
  expect(JSON.parse(checkpoints.find((entry: {name: string}) => entry.name === 'After exploring').json).state.timing.revision).toBe(2);
  await desktopFill(page, '#save-name', '   '); await desktopClick(page, '#save-local');
  await expect(page.locator('#hud-message')).toContainText('Enter a name');
  await expect(page.locator('#saved-games option')).toHaveCount(2);
});
