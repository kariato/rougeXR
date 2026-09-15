import { expect, test } from '@playwright/test';

for (const model of ['hobgoblin', 'kestrel', 'emu', 'rattlesnake', 'bat', 'snake', 'ice-monster', 'orc', 'zombie', 'leprechaun', 'centaur', 'quagga', 'aquator', 'nymph', 'yeti', 'venus-flytrap', 'vampire', 'troll', 'wraith', 'phantom', 'xeroc', 'black-unicorn', 'medusa']) test(`loads the Blender ${model} and plays each exported clip`, async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`/model-preview.html?model=${model}`);
  await expect(page.locator('#model')).toHaveValue(model);
  await expect(page.locator('#status')).toContainText('5 exported animations');
  await expect(page.locator('#animation option')).toHaveText(['idle', 'move', 'attack', 'hurt', 'death']);
  for (const clip of ['move', 'attack', 'hurt', 'death', 'idle']) {
    await page.locator('#animation').selectOption(clip);
    await expect(page.locator('#animation')).toHaveValue(clip);
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  }
  expect(errors).toEqual([]);
});
