import { describe, expect, it } from 'vitest';
import type { PlayerObservation } from '../../src/engine/model/observation';
import { buildPrimitiveCells } from '../../src/presentation/three/scene-plan';

describe('desktop 3D scene plan', () => {
  it('builds geometry exclusively from visible and remembered observations', () => {
    const observation: PlayerObservation = {
      revision: 7, width: 3, height: 1, playerAt: { x: 0, y: 0 },
      cells: [
        { visibility: 'visible', appearance: { glyph: '.', terrainLabel: 'floor', featureLabel: null }, visualRegion: { token: 'a', theme: 'cave', condition: 1, dark: false } },
        { visibility: 'remembered', appearance: { glyph: '+', terrainLabel: 'door', featureLabel: null }, visualRegion: { token: 'a', theme: 'cave', condition: 1, dark: false } },
        { visibility: 'unknown', appearance: null, visualRegion: null },
      ],
      entities: [], decorations: [], status: { hp: 1, maxHp: 1, gold: 0, depth: 1, hungerStage: 0 }, inventory: [], pendingDecision: null,
    };
    expect(buildPrimitiveCells(observation)).toEqual([
      { x: 0, z: 0, kind: 'floor', visibility: 'visible', theme: 'cave', condition: 1, dark: false },
      { x: 1, z: 0, kind: 'door', visibility: 'remembered', theme: 'cave', condition: 1, dark: false },
    ]);
  });

  it('can activate a bounded local neighborhood for first-person rendering', () => {
    const cell = { visibility: 'visible' as const, appearance: { glyph: '.', terrainLabel: 'floor', featureLabel: null }, visualRegion: null };
    const observation: PlayerObservation = { revision: 0, width: 4, height: 1, playerAt: { x: 0, y: 0 }, cells: [cell, cell, cell, cell], entities: [], decorations: [],
      status: { hp: 1, maxHp: 1, gold: 0, depth: 1, hungerStage: 0 }, inventory: [], pendingDecision: null };
    expect(buildPrimitiveCells(observation, 1).map(value => value.x)).toEqual([0, 1]);
  });
});
