import { expect, type Page } from '@playwright/test';

export async function desktopOptions(page: Page): Promise<void> {
  const menu = page.locator('.desktop-menu');
  if (await menu.getAttribute('open') === null) await menu.locator('summary').click();
}
export async function desktopClick(page: Page, selector: string): Promise<void> {
  await desktopOptions(page);
  await page.locator(selector).click();
  if (selector === '#new-game' && await page.locator('#restart-confirm').isVisible()) await page.locator('#confirm-restart').click();
  if (await page.locator('.desktop-menu').getAttribute('open') !== null) await page.locator('.desktop-menu > summary').click();
}
export async function desktopFill(page: Page, selector: string, value: string): Promise<void> {
  await desktopOptions(page); await page.locator(selector).fill(value);
}
export async function toggleTools(page: Page): Promise<void> {
  if (await page.locator('#tools-panel').isVisible()) { await page.keyboard.press('Escape'); return; }
  await desktopClick(page, '#tools-toggle');
}
export async function selectView(page: Page, value: string): Promise<void> {
  await desktopOptions(page); await page.locator('#display-view').selectOption(value);
  await page.locator('.desktop-menu > summary').click();
}
export async function gameKey(page: Page, key: string): Promise<void> {
  await page.locator('h1').click(); await page.keyboard.press(key);
}
/** Mirrors the projection used for spatial panels; clicks follow the ray-selection path. */
export async function clickSpatial(page: Page, x: number, y: number, distance = 1.3): Promise<void> {
  const box = (await page.locator('#dungeon-3d').boundingBox())!;
  const half = distance * Math.tan(34 * Math.PI / 180);
  const scale = distance === 1.3
    ? Math.min(1, box.width / box.height * half / .83, half / .78)
    : Math.min(1, box.width / box.height * half / .82, half / .83);
  await page.locator('#dungeon-3d').click({ position: {
    x: (x * scale / (half * box.width / box.height) + 1) * box.width / 2,
    y: (1 - y * scale / half) * box.height / 2,
  } });
}
export async function openMenu(page: Page): Promise<void> {
  await gameKey(page, 'm');
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-inventory-open', 'true');
}
