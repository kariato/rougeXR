import { expect, test } from '@playwright/test';

test('renders hit impacts and damage flashes and lets them fade', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await page.locator('#welcome-new').click();
  const result = await page.evaluate(async () => {
    const { ThreeGameView } = await import('/src/presentation/three/three-view.ts');
    const { createTwoRoomFixture } = await import('/src/debug/fixtures.ts');
    const { observe } = await import('/src/engine/perception/knowledge.ts');
    const state = createTwoRoomFixture(); state.player.at = { x: 6, y: 5 };
    const monster = state.entities.e1!; if (monster.kind === 'monster') monster.at = { x: 7, y: 5 };
    const view = new ThreeGameView();
    view.canvas.id = 'feedback-preview'; document.body.append(view.canvas);
    view.canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:1000';
    view.resize(innerWidth, innerHeight); view.update(observe(state), []); view.rotatePov(90);
    await new Promise(resolve => setTimeout(resolve, 300));
    const originalNow = performance.now.bind(performance);
    const hitTime = originalNow();
    Object.defineProperty(performance, 'now', { configurable: true, value: () => hitTime });
    state.timing.revision = 1; state.player.stats.hp -= 2;
    view.update(observe(state), [{ type: 'visibleAttack', attackerToken: 'player', defenderToken: 'monster-e1',
      attackerAt: { x: 6, y: 5 }, defenderAt: { x: 7, y: 5 }, hit: true }]);
    Object.defineProperty(performance, 'now', { configurable: true, value: () => hitTime + 80 });
    return { hit: view.canvas.dataset.hitFeedback, damage: view.canvas.dataset.damageFeedback };
  });
  expect(result).toEqual({ hit: 'impact', damage: 'red-flash' });
  await page.locator('#feedback-preview').screenshot({ path: `test-results/hit-feedback-${test.info().project.name}.png` });
  await page.evaluate(() => { delete (performance as { now?: unknown }).now; });
  await page.waitForTimeout(650);
  expect(errors).toEqual([]);
});
