import { gameKey } from './ui-helpers';
import { desktopClick, selectView, toggleTools } from './ui-helpers';
import { expect, test } from '@playwright/test';

test('keyboard POV turning changes the scene without advancing Rogue time', async ({ page }) => {
  await page.goto('/'); await page.locator('#welcome-new').click();
  await toggleTools(page);
  await page.locator('#world-mode').selectOption('rooms');
  await desktopClick(page, '#new-game');
  await expect(page.locator('#state-summary')).toContainText('Tick 0 · Revision 0');
  const canvas = page.locator('#dungeon-3d');
  const before = await canvas.screenshot();
  await page.locator('h1').click();
  await expect(page.locator('#turn-angle')).toHaveValue('90');
  const headings = [];
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press(']');
    headings.push(await canvas.getAttribute('data-pov-direction'));
  }
  expect(headings).toEqual(['E', 'S', 'W', 'N']);
  await page.keyboard.press(']');
  await expect.poll(async () => (await canvas.screenshot()).equals(before), { timeout: 10_000 }).toBe(false);
  await expect(page.locator('#state-summary')).toContainText('Tick 0 · Revision 0');
  await page.locator('#turn-angle').selectOption('90');
  await gameKey(page, '[');
  await expect(page.locator('#state-summary')).toContainText('Tick 0 · Revision 0');
  await selectView(page, 'map');
  await expect(page.locator('#turn-left')).toBeDisabled();
  await expect(page.locator('#turn-right')).toBeDisabled();
  await page.keyboard.press('[');
  await expect(page.locator('#state-summary')).toContainText('Tick 0 · Revision 0');
});
