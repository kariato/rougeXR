import { describe, expect, it } from 'vitest';
import { createTwoRoomFixture } from '../../src/debug/fixtures';
import { cellIndex } from '../../src/engine/grid';
import { debugFixtureSnapshot, describeDebugCell, describeObservedCell, observeFixture } from '../../src/engine/perception/fixture-observation';
import { updateKnowledge } from '../../src/engine/perception/knowledge';

describe('fixture observation', () => {
  it('contains no appearance or entity information for unknown cells', () => {
    const state = createTwoRoomFixture();
    const observation = observeFixture(state);
    const unknown = cellIndex(state.level, { x: 23, y: 5 });
    expect(observation.cells[unknown]).toEqual({ visibility: 'unknown', appearance: null });
    expect(observation.entities).toEqual([]);
    expect(describeObservedCell(observation, unknown)).toEqual(['Cell 23, 5', 'Visibility: unknown']);
  });

  it('distinguishes visible, remembered, and unknown cells', () => {
    const state = createTwoRoomFixture();
    state.player.at = { x: 15, y: 5 }; state.player.roomId = null;
    updateKnowledge(state);
    state.player.at = { x: 5, y: 5 }; state.player.roomId = 0; updateKnowledge(state);
    const observation = observeFixture(state);
    expect(observation.cells[cellIndex(state.level, { x: 5, y: 5 })]?.visibility).toBe('visible');
    expect(observation.cells[cellIndex(state.level, { x: 15, y: 5 })]?.visibility).toBe('remembered');
    expect(observation.cells[cellIndex(state.level, { x: 25, y: 5 })]?.visibility).toBe('unknown');
  });

  it('returns detached snapshots and never changes state or RNG', () => {
    const state = createTwoRoomFixture();
    const before = JSON.stringify(state);
    const observation = observeFixture(state);
    const debug = debugFixtureSnapshot(state);
    observation.playerAt.x = 79;
    debug.entities[0]!.label = 'changed';
    expect(JSON.stringify(state)).toBe(before);
    expect(observeFixture(state)).toEqual(observeFixture(state));
    expect(debugFixtureSnapshot(state)).toEqual(debugFixtureSnapshot(state));
  });

  it('exposes hidden data only through the explicit debug snapshot', () => {
    const state = createTwoRoomFixture();
    const index = cellIndex(state.level, { x: 23, y: 5 });
    const debug = debugFixtureSnapshot(state);
    expect(describeDebugCell(debug, index)).toContain('Debug entity: e1 (fixture.monster)');
    expect(describeDebugCell(debug, index)).toContain('Debug entity: e2 (fixture.gold)');
  });
});
