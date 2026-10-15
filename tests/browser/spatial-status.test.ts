import { expect, it } from 'vitest';
import { createNewGame } from '../../src/engine/new-game';
import { observe } from '../../src/engine/perception/knowledge';
import { spatialStatusLines } from '../../src/presentation/three/spatial-status';
import { IS_BLIND, IS_CONFUSED } from '../../src/engine/rules/flags';
it('reports observed player status, readable equipment, and active conditions', () => {
  const state = createNewGame(12345); state.player.flags |= IS_BLIND | IS_CONFUSED;
  const observation = observe(state);
  expect(observation.status.conditions).toEqual(['Blind', 'Confused']);
  const text = spatialStatusLines(observation).join(' ');
  expect(text).toContain('HP 12/12'); expect(text).toContain('Level 1');
  expect(text).toContain('Mace'); expect(text).not.toContain('weapon.');
  expect(text).toContain('Blind · Confused');
});
