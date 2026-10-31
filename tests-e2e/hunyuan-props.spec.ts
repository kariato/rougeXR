import { expect, test } from '@playwright/test';
for (const id of ['door', 'chest', 'torch', 'urn', 'pillar', 'potion']) {
  test(`loads generated prop ${id} with its animation contract`, async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(`model-preview.html?model=${id}&set=hunyuan-props-v1`);
    await expect(page.locator('canvas')).toHaveAttribute('data-model-ready', id);
    await expect(page.locator('#asset-set')).toHaveValue('hunyuan-props-v1');
    await expect(page.locator('#status')).toContainText('Hunyuan prop');
    if (id === 'door' || id === 'chest') {
      expect((await page.locator('#animation option').allTextContents()).sort()).toEqual(['close', 'open']);
      await page.locator('#animation').selectOption('close'); await page.waitForTimeout(1400);
      if (process.env.ROUGEXR_CAPTURE_ASSETS === '1') await page.locator('canvas').screenshot({ path: `test-results/prop-${id}-closed-${test.info().project.name}.png` });
      await page.locator('#animation').selectOption('open'); await page.waitForTimeout(1400);
      if (process.env.ROUGEXR_CAPTURE_ASSETS === '1') await page.locator('canvas').screenshot({ path: `test-results/prop-${id}-open-${test.info().project.name}.png` });
    } else {
      await expect(page.locator('#animation')).toBeDisabled();
      await expect(page.locator('canvas')).toHaveAttribute('data-clips', '');
      if (process.env.ROUGEXR_CAPTURE_ASSETS === '1') await page.locator('canvas').screenshot({ path: `test-results/prop-${id}-${test.info().project.name}.png` });
    }
    expect(errors).toEqual([]);
  });
}
