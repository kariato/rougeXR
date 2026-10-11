import { expect, test } from '@playwright/test';

test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

test('touch joystick turns the POV, moves forward, and stops on release', async ({ page, browserName }) => {
  test.skip(browserName === 'firefox', 'Playwright Firefox mouse emulation does not emit pointer events with hasTouch enabled.');
  await page.goto('/');
  await page.locator('#tools-toggle').click();
  await page.locator('#world-mode').selectOption('rooms');
  await page.locator('#new-game').dispatchEvent('click');
  await page.locator('#turn-angle').selectOption('90');
  await page.locator('#tools-toggle').click();
  const stick = page.locator('#movement-stick');
  await expect(stick).toBeVisible();
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-player-at', '5,5');
  const box = await stick.boundingBox();
  expect(box).not.toBeNull();
  const centerX = box!.x + box!.width / 2;
  const centerY = box!.y + box!.height / 2;
  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await page.mouse.move(centerX + 35, centerY);
  await expect(stick).toHaveAttribute('data-direction', '0');
  await page.mouse.up();
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-pov-direction', 'E');
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-player-at', '5,5');
  await expect(page.locator('#state-summary')).toContainText('Revision 0');
  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await page.mouse.move(centerX, centerY - 35);
  await expect(stick).toHaveAttribute('data-direction', '2');
  await page.mouse.up();
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-player-at', '6,5');
  await expect(stick).not.toHaveAttribute('data-direction');
  await page.waitForTimeout(350);
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-player-at', '6,5');
});
