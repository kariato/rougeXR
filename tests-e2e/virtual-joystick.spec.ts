import { gameKey } from './ui-helpers';
import { toggleTools } from './ui-helpers';
import { expect, test } from '@playwright/test';

test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

test('diagonal stick drags choose one axis and stop on release', async ({ page, browserName }) => {
  test.skip(browserName === 'firefox', 'Playwright Firefox mouse emulation does not emit pointer events with hasTouch enabled.');
  await page.goto('/'); await page.locator('#welcome-new').click();
  await toggleTools(page);
  await page.locator('#world-mode').selectOption('rooms');
  await page.locator('#new-game').dispatchEvent('click');
  await page.locator('#turn-angle').selectOption('90');
  await toggleTools(page);
  const stick = page.locator('#movement-stick');
  await expect(stick).toBeVisible();
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-player-at', '5,5');
  const box = await stick.boundingBox();
  expect(box).not.toBeNull();
  const centerX = box!.x + box!.width / 2;
  const centerY = box!.y + box!.height / 2;
  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await page.mouse.move(centerX + 35, centerY - 25);
  await expect(stick).toHaveAttribute('data-direction', '0');
  await page.mouse.up();
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-pov-direction', 'E');
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-player-at', '5,5');
  await expect(page.locator('#state-summary')).toContainText('Revision 0');
  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await page.mouse.move(centerX + 25, centerY - 35);
  await expect(stick).toHaveAttribute('data-direction', '2');
  await page.mouse.up();
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-pov-direction', 'E');
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-player-at', '6,5');
  await expect(stick).not.toHaveAttribute('data-direction');
  await page.waitForTimeout(350);
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-player-at', '6,5');
});

test('touch Attack button hits only a monster directly ahead', async ({ page }) => {
  await page.goto('/'); await page.locator('#welcome-new').click();
  await toggleTools(page);
  await page.locator('#world-mode').selectOption('kestrel');
  await page.locator('#new-game').dispatchEvent('click');
  await page.locator('#turn-angle').selectOption('90');
  await toggleTools(page);
  const attack = page.locator('#attack-front');
  await expect(attack).toBeVisible();
  await expect(attack).toBeDisabled();
  await page.locator('h1').click();
  await page.keyboard.press('d');
  await expect(page.locator('#state-summary')).toContainText('Revision 1');
  await gameKey(page, ']');
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-pov-direction', 'E');
  await expect(attack).toBeEnabled();
  await attack.click();
  await expect(page.locator('#state-summary')).toContainText('Revision 2');
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-weapon-action', 'attack');
});

test('larger stick ignores small drifts, locks direction, and turns only once per gesture', async ({ page, browserName }) => {
  test.skip(browserName === 'firefox', 'Firefox mouse emulation does not emit pointer events with hasTouch enabled.');
  await page.goto('/'); await page.locator('#welcome-new').click();
  await toggleTools(page); await page.locator('#world-mode').selectOption('rooms');
  await page.locator('#new-game').dispatchEvent('click'); await toggleTools(page);
  const stick = page.locator('#movement-stick');
  const box = (await stick.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(128);
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x + 10, y - 10);
  await expect(stick).not.toHaveAttribute('data-direction');
  await page.mouse.move(x + 45, y - 5);
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-pov-direction', 'NE');
  await page.mouse.move(x + 5, y - 45); // Drift across the diagonal without returning to center.
  await page.waitForTimeout(700);
  await expect(stick).toHaveAttribute('data-direction', '0');
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-pov-direction', 'NE');
  await expect(page.locator('#state-summary')).toContainText('Revision 0');
  await page.mouse.move(x, y); // Re-arm at the center, then deliberately move forward.
  await page.mouse.move(x, y - 45); await page.mouse.up();
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-player-at', '6,4');
  await expect(page.locator('#state-summary')).toContainText('Revision 1');
  await expect(stick).not.toHaveAttribute('data-direction');
});
