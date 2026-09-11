import { describe, expect, it } from 'vitest';
import { createTwoRoomFixture } from '../../src/debug/fixtures';
import { cellIndex } from '../../src/engine/grid';
import { createRandom } from '../../src/engine/random';
import { GameSession } from '../../src/engine/session';

describe('search', () => {
  it('reveals a secret door with the source one-in-five check', () => {
    const state = createTwoRoomFixture(); const at = { x: 6, y: 4 };
    const tile = state.level.tiles[cellIndex(state.level, at)]!; tile.terrain = 'wallH'; tile.secret = true;
    state.rng = createRandom(5);
    const session = new GameSession(state);
    const result = session.submit({ expectedRevision: 0, action: { type: 'search' } });
    expect(result).toMatchObject({ status: 'resolved', consumedSlot: true, ticksAdvanced: 1 });
    expect(session.exportState().level.tiles[cellIndex(state.level, at)]).toMatchObject({ terrain: 'door', secret: false });
    expect(result.events).toContainEqual({ type: 'message', text: 'You found a secret door.' });
  });
  it('reveals a hidden trap with the source one-in-two check', () => {
    const state = createTwoRoomFixture(); const at = { x: 6, y: 5 };
    state.level.tiles[cellIndex(state.level, at)]!.feature = { kind: 'trap', trap: 'bear', revealed: false };
    state.rng = createRandom(2);
    const session = new GameSession(state);
    session.submit({ expectedRevision: 0, action: { type: 'search' } });
    expect(session.exportState().level.tiles[cellIndex(state.level, at)]!.feature).toEqual({ kind: 'trap', trap: 'bear', revealed: true });
  });
});
