import { describe, expect, it } from 'vitest';
import { createTwoRoomFixture } from '../../src/debug/fixtures';
import { transferItem } from '../../src/engine/entities';
import { cellIndex } from '../../src/engine/grid';
import { IS_CONFUSED, canMoveDiagonally, canStepTerrain, resolveMove, transitionRegion } from '../../src/engine/rules/movement';
import { GameSession } from '../../src/engine/session';

describe('movement rules', () => {
  it('uses the source step_ok terrain mapping and rejects bounds', () => {
    expect(['floor', 'door', 'passage'].every(canStepTerrain)).toBe(true);
    expect(['void', 'wallH', 'wallV'].some(canStepTerrain)).toBe(false);
    const state = createTwoRoomFixture(); state.player.at = { x: 2, y: 3 };
    expect(resolveMove(state, 'W', true)).toMatchObject({ resolved: false, consumedSlot: false, reason: 'blocked' });
  });
  it('requires both orthogonal cells for a diagonal move (M01)', () => {
    const state = createTwoRoomFixture(); const from = { x: 5, y: 5 }; const to = { x: 6, y: 4 };
    expect(canMoveDiagonally(state, from, to)).toBe(true);
    state.level.tiles[cellIndex(state.level, { x: 5, y: 4 })]!.terrain = 'wallV';
    expect(canMoveDiagonally(state, from, to)).toBe(false);
    expect(resolveMove(state, 'NE', true)).toMatchObject({ consumedSlot: false, reason: 'blocked' });
  });
  it('moves cardinally, consumes one slot, and emits the final movement', () => {
    const session = new GameSession(createTwoRoomFixture());
    const result = session.submit({ expectedRevision: 0, action: { type: 'move', direction: 'E', pickup: true } });
    expect(result).toMatchObject({ status: 'resolved', consumedSlot: true, ticksAdvanced: 1 });
    expect(result.events).toContainEqual({ type: 'visibleMovement', token: 'player', from: { x: 5, y: 5 }, to: { x: 6, y: 5 } });
    expect(session.exportState().player.at).toEqual({ x: 6, y: 5 });
  });
  it('updates logical region when crossing room doors', () => {
    const state = createTwoRoomFixture();
    state.player.at = { x: 10, y: 5 }; state.player.roomId = 0;
    transitionRegion(state, state.player.at, { x: 11, y: 5 });
    expect(state.player.roomId).toBe(0);
    transitionRegion(state, { x: 11, y: 5 }, { x: 12, y: 5 });
    expect(state.player.roomId).toBeNull();
    transitionRegion(state, { x: 19, y: 5 }, { x: 20, y: 5 });
    expect(state.player.roomId).toBe(1);
  });
  it('records deferred pickup without changing item ownership', () => {
    const state = createTwoRoomFixture();
    transferItem(state, 'e2', { kind: 'floor', levelId: 1, at: { x: 6, y: 5 } });
    const session = new GameSession(state);
    session.submit({ expectedRevision: 0, action: { type: 'move', direction: 'E', pickup: true } });
    expect(session.trace()).toContainEqual({ kind: 'pickup', detail: 'deferred:e2', tick: 0 });
    expect(session.exportState().entities.e2).toMatchObject({ location: { kind: 'floor', at: { x: 6, y: 5 } } });
  });
  it('decrements no-move before destination calculation and consumes the slot (M02)', () => {
    const state = createTwoRoomFixture(); state.timing.noMove = 1;
    const before = { ...state.player.at }; const result = resolveMove(state, 'E', true);
    expect(result).toMatchObject({ resolved: false, consumedSlot: true, reason: 'stuck' });
    expect(state.player.at).toEqual(before); expect(state.timing.noMove).toBe(0);
  });
  it('retains all random draws when confusion produces no displacement (M03)', () => {
    const state = createTwoRoomFixture(12); state.player.flags |= IS_CONFUSED;
    const beforeDraws = state.rng.draws; const before = { ...state.player.at };
    const result = resolveMove(state, 'E', true);
    expect(result.reason).toBe('confused-no-move');
    expect(state.player.at).toEqual(before); expect(state.rng.draws - beforeDraws).toBe(3);
  });
});
