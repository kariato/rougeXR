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

  it('includes the far end of a visible corridor beyond the local render radius', () => {
    const passage = { visibility: 'visible' as const, appearance: { glyph: '#', terrainLabel: 'passage', featureLabel: null }, visualRegion: null };
    const unknown = { visibility: 'unknown' as const, appearance: null, visualRegion: null };
    const observation: PlayerObservation = { revision: 0, width: 5, height: 1, playerAt: { x: 0, y: 0 },
      cells: [passage, passage, passage, unknown, { ...passage, visibility: 'remembered' }], entities: [], decorations: [],
      status: { hp: 1, maxHp: 1, gold: 0, depth: 1, hungerStage: 0 }, inventory: [], pendingDecision: null };
    expect(buildPrimitiveCells(observation, 1).map(cell => cell.x)).toEqual([0, 1, 2]);
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

  it('paints the outside corner of a corridor bend without capping its undisclosed sides', () => {
    const cells = [
      { x: 1, z: 1, kind: 'passage', visibility: 'visible', theme: 'dungeon', condition: 0, dark: false },
      { x: 1, z: 0, kind: 'passage', visibility: 'visible', theme: 'dungeon', condition: 0, dark: false },
      { x: 2, z: 1, kind: 'passage', visibility: 'visible', theme: 'dungeon', condition: 0, dark: false },
    ] as const;
    const corner = buildCorridorWalls(cells).filter(wall => wall.length === .5);
    expect(corner).toEqual(expect.arrayContaining([
      expect.objectContaining({ x: .75, z: 1.47, axis: 'x' }),
      expect.objectContaining({ x: .53, z: 1.25, axis: 'z' }),
    ]));
    expect(corner).toHaveLength(2);
  });

  it('paints complete bend walls against disclosed empty space and leaves room entrances open', () => {
    const base = { visibility: 'visible' as const, theme: 'dungeon' as const, condition: 0 as const, dark: false };
    const cells = [
      { ...base, x: 1, z: 1, kind: 'passage' as const },
      { ...base, x: 1, z: 0, kind: 'passage' as const },
      { ...base, x: 2, z: 1, kind: 'passage' as const },
      { ...base, x: 0, z: 1, kind: 'void' as const },
      { ...base, x: 1, z: 2, kind: 'void' as const },
      { ...base, x: 3, z: 1, kind: 'floor' as const },
    ];
    const walls = buildCorridorWalls(cells);
    expect(walls).toEqual(expect.arrayContaining([
      expect.objectContaining({ x: .53, z: 1, axis: 'z' }),
      expect.objectContaining({ x: 1, z: 1.47, axis: 'x' }),
    ]));
    expect(walls.some(wall => wall.x === 2.47 && wall.z === 1)).toBe(false);
    expect(walls.some(wall => wall.length === .5)).toBe(false);
  });

  it('distinguishes disclosed void from walkable floor', () => {
    const observation: PlayerObservation = { revision: 0, width: 1, height: 1, playerAt: { x: 0, y: 0 },
      cells: [{ visibility: 'visible', appearance: { glyph: ' ', terrainLabel: 'void', featureLabel: null }, visualRegion: null }],
      entities: [], decorations: [], status: { hp: 1, maxHp: 1, gold: 0, depth: 1, hungerStage: 0 }, inventory: [], pendingDecision: null };
    expect(buildPrimitiveCells(observation)[0]?.kind).toBe('void');
  });

  it('marks only the facing end cap of a fully disclosed dead end', () => {
    const base = { visibility: 'visible' as const, theme: 'dungeon' as const, condition: 0 as const, dark: false };
    const cells = [
      { ...base, x: 2, z: 2, kind: 'passage' as const },
      { ...base, x: 1, z: 2, kind: 'passage' as const },
      { ...base, x: 3, z: 2, kind: 'void' as const },
      { ...base, x: 2, z: 1, kind: 'void' as const },
      { ...base, x: 2, z: 3, kind: 'void' as const },
    ];
    expect(buildCorridorWalls(cells).filter(wall => wall.deadEnd)).toEqual([
      expect.objectContaining({ x: expect.closeTo(2.47), z: 2, axis: 'z' }),
    ]);
    // Unknown terrain and room entrances must never receive an end marker.
    expect(buildCorridorWalls(cells.filter(cell => cell.x !== 3)).some(wall => wall.deadEnd)).toBe(false);
    expect(buildCorridorWalls(cells.map(cell => cell.x === 3 ? { ...cell, kind: 'door' as const } : cell)).some(wall => wall.deadEnd)).toBe(false);
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
