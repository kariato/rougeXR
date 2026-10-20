import { expect, test } from '@playwright/test';
import { gameKey, toggleTools } from './ui-helpers';

test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

for (const [turns, heading, destination] of [[1, 'NE', '6,4'], [3, 'SE', '6,6'], [5, 'SW', '4,6'], [7, 'NW', '4,4']] as const) {
  test(`Forward moves diagonally at ${turns * 45} degrees (${heading})`, async ({ page }) => {
    await page.goto('/'); await page.locator('#welcome-new').click();
    await toggleTools(page); await page.locator('#world-mode').selectOption('rooms');
    await page.locator('#new-game').dispatchEvent('click'); await toggleTools(page);
    for (let index = 0; index < turns; index++) await gameKey(page, ']');
    const canvas = page.locator('#dungeon-3d');
    await expect(canvas).toHaveAttribute('data-pov-direction', heading);
    await expect(page.locator('#state-summary')).toContainText('Revision 0');
    await page.locator('#attack-front').click();
    await expect(canvas).toHaveAttribute('data-player-at', destination);
    await expect(page.locator('#state-summary')).toContainText('Revision 1');
    await gameKey(page, 's');
    await expect(canvas).toHaveAttribute('data-player-at', '5,5');
    await expect(page.locator('#state-summary')).toContainText('Revision 2');
    await gameKey(page, 'w');
    await expect(canvas).toHaveAttribute('data-player-at', destination);
    await expect(page.locator('#state-summary')).toContainText('Revision 3');
    await gameKey(page, 'ArrowDown');
    await expect(canvas).toHaveAttribute('data-player-at', '5,5');
    await gameKey(page, 'ArrowUp');
    await expect(canvas).toHaveAttribute('data-player-at', destination);
    await expect(page.locator('#state-summary')).toContainText('Revision 5');
  });
}
