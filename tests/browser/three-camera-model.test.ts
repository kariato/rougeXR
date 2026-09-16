import { describe, expect, it } from 'vitest';
import { frontMonsterAttackRequest, nearestVisibleHit, smoothToward } from '../../src/presentation/three/camera-model';
import type { PlayerObservation } from '../../src/engine/model/observation';

describe('desktop 3D camera model', () => {
  it('smooths identically for equivalent elapsed time', () => {
    const oneStep = smoothToward(0, 10, 8, 1);
    let manySteps = 0;
    for (let index = 0; index < 60; index++) manySteps = smoothToward(manySteps, 10, 8, 1 / 60);
    expect(manySteps).toBeCloseTo(oneStep, 10);
  });

  it('sorts hits and stops selection at nearer occluding geometry', () => {
    expect(nearestVisibleHit([
      { distance: 5, eligible: true, occludes: false, value: 'far' },
      { distance: 2, eligible: true, occludes: false, value: 'near' },
    ])).toBe('near');
    expect(nearestVisibleHit([
      { distance: 5, eligible: true, occludes: false, value: 'hidden' },
      { distance: 2, eligible: false, occludes: true, value: 'wall' },
    ])).toBeNull();
  });
});

describe('first-person click combat', () => {
  const observation = (monsterAt: { x: number; y: number }): PlayerObservation => ({
    revision: 7, width: 5, height: 5, playerAt: { x: 2, y: 2 }, cells: [], decorations: [],
    entities: [{ token: 'monster-e1', at: monsterAt, appearance: 'K', label: 'monster.kestrel' }],
    status: { hp: 10, maxHp: 10, gold: 0, depth: 1, hungerStage: 0 }, inventory: [], pendingDecision: null,
  });

  it('submits source bump combat for an adjacent monster in the POV direction', () => {
    expect(frontMonsterAttackRequest(observation({ x: 3, y: 2 }), 'E')).toEqual({
      expectedRevision: 7, action: { type: 'move', direction: 'E', pickup: true },
    });
  });

  it('does not attack monsters beside the POV or beyond one Rogue cell', () => {
    expect(frontMonsterAttackRequest(observation({ x: 2, y: 1 }), 'E')).toBeNull();
    expect(frontMonsterAttackRequest(observation({ x: 4, y: 2 }), 'E')).toBeNull();
  });
});
