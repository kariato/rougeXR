import { expect, test } from '@playwright/test';

test('faces and animates the visible Kestrel during resolved combat', async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');await page.locator('#tools-toggle').click();
  await page.locator('#world-mode').selectOption('kestrel');await page.locator('#new-game').click();
  await expect(page.locator('#dungeon-3d')).toBeVisible();
  await page.locator('h1').click();await page.keyboard.press('d');
  await expect(page.locator('#state-summary')).toContainText('Revision 1');
  await page.keyboard.press('d');
  await expect(page.locator('#state-summary')).toContainText('Revision 2');
  await expect(page.locator('#messages')).toContainText(/You (hit|missed)/);
  await expect(page.locator('#messages')).toContainText(/The monster (hit|missed)/);
  await page.waitForTimeout(130);
  await page.locator('#dungeon-3d').screenshot({ path: 'test-results/combat-actions.png' });
  await page.waitForTimeout(1400);
  await page.screenshot({ path: 'test-results/combat-after.png' });
  expect(errors).toEqual([]);
});

test('shows a first-person gesture for a resolved search action', async ({ page }) => {
  const errors: string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');await page.locator('h1').click();await page.keyboard.press('f');
  await expect(page.locator('#state-summary')).toContainText('Revision 1');
  await page.waitForTimeout(100);
  await page.locator('#dungeon-3d').screenshot({path:'test-results/interaction-action.png'});
  expect(errors).toEqual([]);
});

test('keeps a slain monster in its death pose after a turn and a map switch', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await page.locator('#tools-toggle').click();
  await page.locator('#world-mode').selectOption('kestrel'); await page.locator('#new-game').click();
  await page.locator('#view-mode').selectOption('2d');
  await page.locator('h1').click();
  for (let revision = 1; revision <= 12; revision++) {
    await page.keyboard.press('d');
    await expect(page.locator('#state-summary')).toContainText(`Revision ${revision}`);
    if (/You defeated/.test(await page.locator('#messages').innerText())) break;
  }
  await expect(page.locator('#messages')).toContainText('You defeated');
  await page.locator('#view-mode').selectOption('3d');
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-visible-corpses', '1');
  await page.waitForTimeout(1400);
  await page.locator('#dungeon-3d').screenshot({ path: 'test-results/corpse-after-map.png' });
  await page.locator('h1').click(); await page.keyboard.press('f');
  await page.waitForTimeout(300);
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-visible-corpses', '1');
  await page.locator('#dungeon-3d').screenshot({ path: 'test-results/corpse-after-turn.png' });
  await page.locator('#view-mode').selectOption('2d'); await page.locator('#view-mode').selectOption('3d');
  await page.waitForTimeout(300);
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-visible-corpses', '1');
  await page.locator('#dungeon-3d').screenshot({ path: 'test-results/corpse-after-toggle.png' });
  expect(errors).toEqual([]);
});
