import { gameKey, toggleTools } from './ui-helpers';
import { expect, test } from '@playwright/test';

test('renders all revealed trap types and keeps a hidden trap absent', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await page.locator('#welcome-new').click(); await toggleTools(page);
  const save = await page.evaluate(async () => {
    const { createTwoRoomFixture } = await import('/src/debug/fixtures.ts');
    const { GameSession } = await import('/src/engine/session.ts');
    const { serializeSave } = await import('/src/persistence/save.ts');
    const state = createTwoRoomFixture();
    const kinds = ['trapDoor', 'bear', 'sleep', 'arrow', 'teleport', 'dart', 'rust', 'mystery'] as const;
    kinds.forEach((trap, i) => { state.level.tiles[(4 + Math.floor(i / 4) * 3) * state.level.width + 4 + i % 4 * 2]!.feature = { kind: 'trap', trap, revealed: true }; });
    state.level.tiles[8 * state.level.width + 3]!.feature = { kind: 'trap', trap: 'bear', revealed: false };
    return serializeSave(new GameSession(state).exportState());
  });
  await page.locator('#load-file').setInputFiles({ name: 'traps.json', mimeType: 'application/json', buffer: Buffer.from(save) });
  await expect.poll(async () => (await page.locator('#dungeon-3d').getAttribute('data-visible-traps'))?.split(',').length).toBe(8);
  await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const { createTrapVisual } = await import('/src/presentation/three/trap-asset.ts');
    const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setSize(innerWidth, innerHeight);
    renderer.domElement.id = 'trap-gallery'; renderer.domElement.style.cssText = 'position:fixed;inset:0;z-index:1000'; document.body.append(renderer.domElement);
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x111820);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x667788, 3));
    const lamp = new THREE.DirectionalLight(0xffe4c0, 3); lamp.position.set(-2, 5, 3); scene.add(lamp);
    const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, .1, 50); camera.position.set(0, 4.2, 5); camera.lookAt(0, 0, .5);
    const kinds = ['trapDoor', 'bear', 'sleep', 'arrow', 'teleport', 'dart', 'rust', 'mystery'] as const;
    kinds.forEach((kind, index) => {
      const trap = createTrapVisual(kind); trap.position.set((index % 4 - 1.5) * 1.1, 0, Math.floor(index / 4) * 1.3);
      trap.traverse(object => { if (object.userData.faceCamera) object.quaternion.copy(camera.quaternion); }); scene.add(trap);
    });
    renderer.render(scene, camera);
  });
  await page.locator('#trap-gallery').screenshot({ path: `test-results/revealed-traps-${test.info().project.name}.png` });
  expect(errors).toEqual([]);
});

for (const feature of ['door', 'passage', 'trap'] as const) test(`search visibly discovers a secret ${feature}`, async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await page.locator('#welcome-new').click(); await toggleTools(page);
  const save = await page.evaluate(async feature => {
    const { createTwoRoomFixture } = await import('/src/debug/fixtures.ts');
    const { createRandom } = await import('/src/engine/random.ts');
    const { GameSession } = await import('/src/engine/session.ts');
    const { serializeSave } = await import('/src/persistence/save.ts');
    const state = createTwoRoomFixture(); state.rng = createRandom(feature === 'door' ? 5 : 2);
    if (feature === 'passage') {
      state.player.at = { x: 13, y: 5 }; state.player.roomId = null;
      Object.assign(state.level.tiles[5 * state.level.width + 14]!, { terrain: 'void', secret: true });
    } else if (feature === 'door') Object.assign(state.level.tiles[4 * state.level.width + 6]!, { terrain: 'wallH', secret: true });
    else state.level.tiles[5 * state.level.width + 6]!.feature = { kind: 'trap', trap: 'bear', revealed: false };
    state.knowledge.remembered.fill(null);
    return serializeSave(new GameSession(state).exportState());
  }, feature);
  await page.locator('#load-file').setInputFiles({ name: 'search.json', mimeType: 'application/json', buffer: Buffer.from(save) });
  if (feature === 'trap') await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-visible-traps', '');
  for (let attempt = 0; attempt < 20; attempt++) {
    await gameKey(page, 'f');
    await expect(page.locator('#state-summary')).toContainText(`Revision ${attempt + 1}`);
    if ((await page.locator('#dungeon-3d').getAttribute('data-discoveries'))?.includes(feature === 'trap' ? 'bear' : feature)) break;
  }
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-discoveries', new RegExp(feature === 'trap' ? 'bear' : feature));
  if (feature === 'trap') await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-visible-traps', 'bear');
  if (feature === 'passage') await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-dead-end-walls', '0');
  await expect(page.locator('#dungeon-3d')).toHaveAttribute('data-spatial-message', /You found/);
  expect(errors).toEqual([]);
});
