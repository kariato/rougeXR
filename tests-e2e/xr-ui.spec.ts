import { expect, test } from '@playwright/test';
import { clickSpatial, gameKey } from './ui-helpers';

for (const size of [{ width: 901, height: 1013 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test(`keeps spatial navigation reachable at ${size.width}×${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('/'); await page.locator('#welcome-new').click();
    const bounds = await page.locator('#dungeon-3d').evaluate(canvas => {
      const box = canvas.getBoundingClientRect();
      return { left: box.left, right: box.right, bottom: box.bottom, width: innerWidth, height: innerHeight };
    });
    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(bounds.width + .5);
    expect(bounds.bottom).toBeLessThanOrEqual(bounds.height + .5);
    await clickSpatial(page, .49, -.48); // Menu via the same ray-selectable mesh used by VR controllers.
    await expect(page.locator('#dungeon-3d')).toHaveAttribute('aria-description', /Continue adventure/);
    await clickSpatial(page, -.48, -.38); // Settings
    await expect(page.locator('#dungeon-3d')).toHaveAttribute('aria-description', /Quieter.*Louder/);
    await clickSpatial(page, .52, .61); // Close
    await clickSpatial(page, -.49, -.48); // Inventory
    await expect(page.locator('#dungeon-3d')).toHaveAttribute('aria-description', /Food ration/);
    await expect(page.locator('#dungeon-3d')).not.toHaveAttribute('aria-description', /Previous|Next|1 \/ 1/);
    await page.keyboard.press('Escape');
    await clickSpatial(page, 0, -.48); // Contextual Actions
    await clickSpatial(page, -.36, .28); // Search
    await expect(page.locator('#state-summary')).toContainText('Revision 1');
    if (size.width === 901) await page.screenshot({ path: `test-results/xr-ui-gameplay-${test.info().project.name}.png` });
  });
}

test('requires an explicit targeting step before throwing an inventory item', async ({ page }) => {
  await page.goto('/'); await page.locator('#welcome-new').click();
  await gameKey(page, 'i');
  await clickSpatial(page, 0, .15); // Equipped mace, third row.
  await clickSpatial(page, -.18, -.44); // Throw
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('aria-description', /CHOOSE A DIRECTION/);
  await expect(page.locator('#state-summary')).toContainText('Revision 0');
  await clickSpatial(page, .4, 0); // East
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('aria-description', /Throw E/);
  await clickSpatial(page, 0, -.52); // Cancel
  await expect(page.locator('#state-summary')).toContainText('Revision 0');
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('aria-description', /INVENTORY/);
  await clickSpatial(page, -.18, -.44);
  await clickSpatial(page, 0, -.36); // Confirm Throw E
  await expect(page.locator('#state-summary')).toContainText('Revision 1');
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-inventory-open', 'false');
});

test('hides empty and expired spatial messages while preserving modal visibility', async ({ page }) => {
  await page.goto('/'); await page.locator('#welcome-new').click();
  const result = await page.evaluate(async () => {
    const { SpatialStatus } = await import('/src/presentation/three/spatial-status.ts');
    const { createTwoRoomFixture } = await import('/src/debug/fixtures.ts');
    const { GameSession } = await import('/src/engine/session.ts');
    const { observe } = await import('/src/engine/perception/knowledge.ts');
    let invalidations = 0;
    const status = new SpatialStatus(() => {}, () => { invalidations++; });
    const observation = observe(new GameSession(createTwoRoomFixture()).exportState());
    status.update(observation, []);
    const message = status.root.children.find(child => child.position.y < 0)!;
    const emptyVisible = message.visible;
    status.update(observation, [{ type: 'message', text: 'You found a secret passage.' }]);
    const activeVisible = message.visible;
    status.setModalOpen(true);
    const visibleBehindMenu = message.visible;
    status.setModalOpen(false);
    const visibleAfterClosing = message.visible;
    await new Promise(resolve => setTimeout(resolve, 6750));
    const expiredVisible = message.visible;
    status.reset(); status.dispose();
    return { emptyVisible, activeVisible, visibleBehindMenu, visibleAfterClosing, expiredVisible, invalidations };
  });
  expect(result).toEqual({ emptyVisible: false, activeVisible: true, visibleBehindMenu: false, visibleAfterClosing: true, expiredVisible: false, invalidations: 1 });
});

test('preserves message history across view changes before the first turn', async ({ page }) => {
  await page.goto('/'); await page.locator('#welcome-new').click();
  await gameKey(page, 'm');
  await clickSpatial(page, -.36, .1); // Save without spending a turn.
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-spatial-message', /Game saved/);
  await clickSpatial(page, -.48, -.38); // Settings
  await clickSpatial(page, 0, -.28); // Switch to tabletop.
  await gameKey(page, 'm');
  await clickSpatial(page, .48, -.38); // Messages
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('aria-description', /MESSAGE HISTORY.*Game saved/s);
  await expect(page.locator('#state-summary')).toContainText('Revision 0');
});
