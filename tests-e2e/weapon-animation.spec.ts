import { expect, test } from '@playwright/test';

test('equipped weapon swings on hits and misses and returns to ready', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await page.locator('#welcome-new').click();
  const poses = await page.evaluate(async () => {
    const { ThreeGameView } = await import('/src/presentation/three/three-view.ts');
    const { createNewGame } = await import('/src/engine/new-game.ts');
    const { observe } = await import('/src/engine/perception/knowledge.ts');
    const state = createNewGame(12345), view = new ThreeGameView();
    const host = document.createElement('div'); host.style.cssText = 'position:fixed;inset:0;z-index:1000'; document.body.append(host);
    view.mount(host); view.canvas.id = 'weapon-preview';
    view.update(observe(state), []);
    await new Promise(resolve => setTimeout(resolve, 300));
    let now = performance.now();
    Object.defineProperty(performance, 'now', { configurable: true, value: () => now });
    const samples = [];
    for (const hit of [false, true]) {
      const ready = view.canvas.dataset.weaponPose;
      state.timing.revision++;
      view.update(observe(state), [{ type: 'visibleAttack', attackerToken: 'player', defenderToken: 'monster-test',
        attackerAt: { ...state.player.at }, defenderAt: { x: state.player.at.x, y: state.player.at.y - 1 }, hit }]);
      now += 160; view.update(observe(state), []);
      const windup = view.canvas.dataset.weaponPose;
      now += 150; view.update(observe(state), []);
      const strike = view.canvas.dataset.weaponPose;
      now += 500; view.update(observe(state), []);
      samples.push({ ready, windup, strike, recovered: view.canvas.dataset.weaponPose });
    }
    delete (performance as { now?: unknown }).now;
    view.dispose(); host.remove(); return samples;
  });
  for (const pose of poses) {
    expect(pose.windup).not.toBe(pose.ready);
    expect(pose.strike).not.toBe(pose.windup);
    expect(pose.recovered).toBe(pose.ready);
  }
  expect(errors).toEqual([]);
});
