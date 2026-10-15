import { expect, it } from 'vitest';
import * as THREE from 'three';
import { HitFeedback } from '../../src/presentation/three/hit-feedback';
import type { PresentationEvent } from '../../src/engine/model/action';
const attack = (hit: boolean): PresentationEvent => ({ type: 'visibleAttack', attackerToken: 'player', defenderToken: 'monster-e1',
  attackerAt: { x: 1, y: 1 }, defenderAt: { x: 2, y: 1 }, hit });
it('shows an impact only for a landed hit and releases it after the fade', () => {
  const feedback = new HitFeedback(), camera = new THREE.PerspectiveCamera();
  feedback.trigger([attack(false)], false, 1000);
  expect(feedback.update(1100, camera)).toBe(false);
  feedback.trigger([attack(true)], false, 1200);
  expect(feedback.root.children).toHaveLength(2);
  expect(feedback.update(1300, camera)).toBe(true);
  expect(feedback.update(1600, camera)).toBe(false);
  expect(feedback.root.children).toHaveLength(1);
  feedback.dispose();
});
it('flashes the screen edges for damage and clears feedback on reset', () => {
  const feedback = new HitFeedback(), camera = new THREE.PerspectiveCamera();
  feedback.trigger([], true, 1000);
  expect(feedback.update(1100, camera)).toBe(true);
  expect(feedback.root.children[0]!.visible).toBe(true);
  expect(feedback.update(1500, camera)).toBe(false);
  expect(feedback.root.children[0]!.visible).toBe(false);
  feedback.trigger([attack(true)], true, 2000); feedback.reset();
  expect(feedback.update(2100, camera)).toBe(false);
  feedback.dispose();
});
