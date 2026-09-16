import { describe, expect, it } from 'vitest';
import type { PlayerObservation } from '../../src/engine/model/observation';
import { buildCorridorWalls, buildPrimitiveCells, selectLitTorches } from '../../src/presentation/three/scene-plan';

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

  it('adds side walls around disclosed corridor cells and leaves connected ends open', () => {
    const passage = { visibility: 'visible' as const, appearance: { glyph: '#', terrainLabel: 'passage', featureLabel: null }, visualRegion: null };
    const door = { visibility: 'visible' as const, appearance: { glyph: '+', terrainLabel: 'door', featureLabel: null }, visualRegion: null };
    const observation: PlayerObservation = { revision: 0, width: 3, height: 1, playerAt: { x: 1, y: 0 }, cells: [door, passage, passage], entities: [], decorations: [],
      status: { hp: 1, maxHp: 1, gold: 0, depth: 1, hungerStage: 0 }, inventory: [], pendingDecision: null };
    const walls = buildCorridorWalls(buildPrimitiveCells(observation));
    expect(walls.filter(wall => wall.x === 1)).toHaveLength(2);
    expect(walls).toHaveLength(4);
    expect(walls.some(wall => wall.z === 0 && wall.x > .5 && wall.x < 1.5)).toBe(false);
    expect(walls.some(wall => wall.z === 0 && wall.x > 2)).toBe(false);
  });

  it('does not build a false end wall across an undisclosed corridor continuation', () => {
    const cells = [
      { x: 0, z: 0, kind: 'door', visibility: 'remembered', theme: 'dungeon', condition: 0, dark: false },
      { x: 1, z: 0, kind: 'passage', visibility: 'visible', theme: 'dungeon', condition: 0, dark: false },
    ] as const;
    const walls = buildCorridorWalls(cells);
    expect(walls).toEqual(expect.arrayContaining([
      expect.objectContaining({ x: 1, z: -.47, axis: 'x' }),
      expect.objectContaining({ x: 1, z: .47, axis: 'x' }),
    ]));
    expect(walls.some(wall => wall.axis === 'z')).toBe(false);
  });

  it('lights at most four currently visible torches and excludes remembered or reserved cells', () => {
    const visible = { visibility: 'visible' as const, appearance: { glyph: '-', terrainLabel: 'wallH', featureLabel: null }, visualRegion: null };
    const observation: PlayerObservation = {
      revision: 0, width: 8, height: 1, playerAt: { x: 0, y: 0 },
      cells: [visible, visible, visible, visible, visible, visible,
        { ...visible, visibility: 'remembered' }, { visibility: 'unknown', appearance: null, visualRegion: null }],
      entities: [], decorations: Array.from({ length: 7 }, (_, index) => ({ token: `torch-${index + 1}`, at: { x: index + 1, y: 0 },
        kind: 'torch' as const, rotation: 0 as const, variant: 0, scale: 1, theme: 'dungeon' as const })),
      status: { hp: 1, maxHp: 1, gold: 0, depth: 1, hungerStage: 0 }, inventory: [], pendingDecision: null,
    };
    expect([...selectLitTorches(observation, new Set(['1,0', '2,0', '3,0', '4,0', '5,0', '6,0', '7,0']), new Set(['2,0']))])
      .toEqual(['torch-1', 'torch-3', 'torch-4', 'torch-5']);
  });
});
