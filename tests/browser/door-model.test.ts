import { describe, expect, it } from 'vitest';
import type { PlayerObservation, ObservedCell } from '../../src/engine/model/observation';
import { doorOpenProgress, roomFacingForDoor } from '../../src/presentation/three/door-model';

const cell = (terrain: string, token: string | null, visibility: ObservedCell['visibility'] = 'visible'): ObservedCell => ({
  visibility, appearance: visibility === 'unknown' ? null : { glyph: terrain === 'door' ? '+' : '.', terrainLabel: terrain, featureLabel: null },
  visualRegion: token === null || visibility === 'unknown' ? null : { token, theme: 'dungeon', condition: 0, dark: false },
});

const observation = (cells: ObservedCell[], width: number, height: number): PlayerObservation => ({
  revision: 0, width, height, playerAt: { x: 0, y: 0 }, cells, entities: [], decorations: [],
  status: { hp: 10, maxHp: 10, gold: 0, depth: 1, hungerStage: 0 }, inventory: [], pendingDecision: null,
});

describe('room-facing hinged doors', () => {
  it('points the leaf at the disclosed interior rather than the corridor', () => {
    const west = observation([cell('floor', 'room'), cell('door', 'room'), cell('passage', null)], 3, 1);
    const east = observation([cell('passage', null), cell('door', 'room'), cell('floor', 'room')], 3, 1);
    expect(roomFacingForDoor(west, 1, 0)).toEqual({ dx: -1, dz: 0, yaw: -Math.PI / 2 });
    expect(roomFacingForDoor(east, 1, 0)).toEqual({ dx: 1, dz: 0, yaw: Math.PI / 2 });
    const north = observation([cell('floor', 'room'), cell('door', 'room'), cell('passage', null)], 1, 3);
    const south = observation([cell('passage', null), cell('door', 'room'), cell('floor', 'room')], 1, 3);
    expect(roomFacingForDoor(north, 0, 1)?.dz).toBe(-1);
    expect(roomFacingForDoor(south, 0, 1)?.dz).toBe(1);
  });

  it('does not infer an undisclosed room side', () => {
    const hidden = observation([cell('floor', 'room', 'unknown'), cell('door', 'room'), cell('passage', null)], 3, 1);
    expect(roomFacingForDoor(hidden, 1, 0)).toBeNull();
  });

  it('eases the one-time swing and holds its open pose', () => {
    expect(doorOpenProgress(null, 1000)).toBe(0);
    expect(doorOpenProgress(1000, 1000)).toBe(0);
    expect(doorOpenProgress(1000, 1350)).toBeCloseTo(0.5);
    expect(doorOpenProgress(1000, 2000)).toBe(1);
  });
});
