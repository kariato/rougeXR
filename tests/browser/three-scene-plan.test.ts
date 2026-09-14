import { describe, expect, it } from 'vitest';
import type { PlayerObservation } from '../../src/engine/model/observation';
import { buildPrimitiveCells } from '../../src/presentation/three/scene-plan';

describe('desktop 3D scene plan', () => {
  it('builds geometry exclusively from visible and remembered observations', () => {
    const observation: PlayerObservation = {
      revision: 7, width: 3, height: 1, playerAt: { x: 0, y: 0 },
      cells: [
        { visibility: 'visible', appearance: { glyph: '.', terrainLabel: 'floor', featureLabel: null } },
        { visibility: 'remembered', appearance: { glyph: '+', terrainLabel: 'door', featureLabel: null } },
        { visibility: 'unknown', appearance: null },
      ],
      entities: [], status: { hp: 1, maxHp: 1, gold: 0, depth: 1, hungerStage: 0 }, inventory: [], pendingDecision: null,
    };
    expect(buildPrimitiveCells(observation)).toEqual([
      { x: 0, z: 0, kind: 'floor', visibility: 'visible' },
      { x: 1, z: 0, kind: 'door', visibility: 'remembered' },
    ]);
  });
});
