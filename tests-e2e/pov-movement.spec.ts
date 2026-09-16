import { expect, test } from '@playwright/test';

test('arrow keys turn and move forward or backward relative to POV', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await page.locator('#tools-toggle').click();
  await page.locator('#world-mode').selectOption('rooms'); await page.locator('#new-game').dispatchEvent('click');
  await page.locator('#turn-angle').selectOption('90'); await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-player-at', '5,5');
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-pov-direction', 'N');
  const press = (key: string) => page.evaluate(value => window.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true })), key);
  await press('ArrowRight');
  await expect(page.locator('#state-summary')).toContainText('Revision 0');
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-pov-direction', 'E');
  await press('ArrowUp');
  await expect(page.locator('#state-summary')).toContainText('Revision 1');
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-player-at', '6,5');
  await press('ArrowDown');
  await expect(page.locator('#state-summary')).toContainText('Revision 2');
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-player-at', '5,5');
  expect(errors).toEqual([]);
});
