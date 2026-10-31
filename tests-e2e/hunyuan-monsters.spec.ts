import { expect, test } from '@playwright/test';
import { MONSTER_DEFINITIONS } from '../src/definitions/combat';

for (const monster of MONSTER_DEFINITIONS) {
  const id = monster.id.replace('monster.', '');
  test(`loads Hunyuan monster ${id} with five animation clips`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`model-preview.html?model=${id}&set=hunyuan-v1`);
    await expect(page.locator('canvas')).toHaveAttribute('data-model-ready', id);
    await expect(page.locator('#status')).toContainText('5 exported animations');
    await expect(page.locator('#asset-set')).toHaveValue('hunyuan-v1');
    const clips = await page.locator('#animation option').allTextContents();
    expect(clips.sort()).toEqual(['attack', 'death', 'hurt', 'idle', 'move']);
    for (const clip of ['move', 'attack', 'hurt', 'death']) {
      await page.locator('#animation').selectOption(clip);
      await expect(page.locator('#animation')).toHaveValue(clip);
    }
    await page.locator('#animation').selectOption('attack');
    await page.waitForTimeout(300);
    if (process.env.ROUGEXR_CAPTURE_ASSETS === '1') await page.locator('canvas').screenshot({ path: `test-results/hunyuan-${id}-${test.info().project.name}.png` });
    expect(errors).toEqual([]);
  });
}
