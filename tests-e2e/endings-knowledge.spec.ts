import { expect, test, type Page } from '@playwright/test';
async function click3d(page: Page, x: number, y: number) {
  const box = (await page.locator('#dungeon-3d').boundingBox())!, half = 1.3 * Math.tan(34 * Math.PI / 180);
  await page.locator('#dungeon-3d').click({ position: { x: (x / (half * box.width / box.height) + 1) * box.width / 2, y: (1 - y / half) * box.height / 2 } });
}
async function loadFixture(page: Page, outcome?: 'dead' | 'won') {
  const json = await page.evaluate(async outcome => {
    const { createNewGame } = await import('/src/engine/new-game.ts');
    const { GameSession } = await import('/src/engine/session.ts');
    const { serializeSave } = await import('/src/persistence/save.ts');
    const state = new GameSession(createNewGame(12345)).exportState();
    for (const entry of state.identification) entry.known = ['potion.healing', 'scroll.magic-mapping', 'ring.protection', 'stick.fire'].includes(entry.definitionId);
    state.sourceState.maximumDepth = 9; state.player.gold = 123; state.player.stats.experience = 42;
    if (outcome) {
      state.timing.status = outcome; state.timing.cycle = { phase: 'terminal', slotsRemaining: 0 };
      if (outcome === 'dead') { state.player.stats.hp = 0; state.timing.deathCause = 'dragon fire'; }
    }
    return serializeSave(state);
  }, outcome);
  await page.locator('#load-file').setInputFiles({ name: 'fixture.json', mimeType: 'application/json', buffer: Buffer.from(json) });
}
for (const outcome of ['dead', 'won'] as const) test(`${outcome} shows full in-world and map results and can resume a named save`, async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await page.locator('#welcome-new').click(); await page.locator('#save-name').fill('Before the ending'); await page.locator('#save-local').click();
  await expect(page.locator('#saved-games')).toContainText('Before the ending');
  await loadFixture(page, outcome);
  const canvas = page.locator('#dungeon-3d');
  await expect(canvas).toHaveAttribute('aria-description', /Depth reached: 9.*Gold: 123.*Score:/);
  await expect(canvas).toHaveAttribute('aria-description', /Restart.*Load Save/);
  await expect(canvas).toHaveAttribute('aria-label', outcome === 'dead' ? /DEAD.*dragon fire/ : /VICTORY.*Amulet/);
  await canvas.screenshot({ path: `test-results/ending-${outcome}-${test.info().project.name}.png` });
  await page.locator('#view-mode').selectOption('2d');
  await expect(page.locator('#ending-panel')).toBeVisible();
  await expect(page.locator('#ending-score')).toHaveText(outcome === 'dead' ? 'Score: 165 (gold + experience)' : 'Score: 1165 (gold + experience + 1,000 escape bonus)');
  await page.locator('#view-mode').selectOption('3d');
  await click3d(page, .36, -.34);
  await expect(canvas).toHaveAttribute('aria-description', /Before the ending/);
  await click3d(page, 0, .34);
  await expect(canvas).toHaveAttribute('data-dead', 'false');
  await expect(canvas).toHaveAttribute('data-inventory-open', 'false');
  await loadFixture(page, outcome);
  await page.locator('#view-mode').selectOption('2d');
  await page.locator('#ending-restart').click();
  await expect(page.locator('#ending-panel')).toBeHidden();
  await expect(page.locator('#hud-hp')).toHaveText('12/12');
  expect(errors).toEqual([]);
});
test('readable inventory and discoveries work in tools and the in-world menu', async ({ page }) => {
  await page.goto('/'); await page.locator('#welcome-new').click(); await loadFixture(page);
  await page.locator('#tools-toggle').click();
  await expect(page.locator('#inventory')).toContainText('Mace');
  await expect(page.locator('#inventory')).not.toContainText('weapon.');
  await expect(page.locator('#discoveries')).toContainText('Potion of healing');
  await expect(page.locator('#discoveries p')).toHaveCount(4);
  await expect(page.locator('#discoveries')).not.toContainText('confusion');
  await page.locator('#tools-toggle').click();
  await page.locator('h1').click(); await page.keyboard.press('m'); await click3d(page, -.5, .59);
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('aria-description', /DISCOVERIES.*Potion of healing.*Scroll of magic mapping.*Ring of protection.*(Wand|Staff) of fire/s);
  await page.locator('#dungeon-3d').screenshot({ path: `test-results/discoveries-${test.info().project.name}.png` });
});
