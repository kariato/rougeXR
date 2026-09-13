import { describe, expect, it } from 'vitest';
import { createTwoRoomFixture } from '../../src/debug/fixtures';
import { GameSession } from '../../src/engine/session';
import { canonicalState, hashState } from '../../src/persistence/canonical';
import { SAVE_VERSION, parseSave, restoreGame, serializeSave } from '../../src/persistence/save';

describe('save state', () => {
  it('round trips the complete current state and rejects incompatible envelopes', () => {
    const state = new GameSession(createTwoRoomFixture()).exportState(); const parsed = parseSave(serializeSave(state));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value.state).toEqual(state);
    expect(parseSave('{"format":"rougexr-save","version":99}')).toMatchObject({ ok: false });
    expect(parseSave('not json')).toMatchObject({ ok: false });
  });
  it('rejects duplicate ownership without replacing an existing session (S02)', () => {
    const live = new GameSession(createTwoRoomFixture()); const before = live.exportState();
    const invalid = createTwoRoomFixture(); invalid.player.packOrder.push('e2');
    const parsed = parseSave(JSON.stringify({ format: 'rougexr-save', version: SAVE_VERSION,
      upstream: 'f4653c2a2ee6981a73abe9dfda055134285e1e79', state: invalid }));
    expect(parsed.ok).toBe(false); expect(live.exportState()).toEqual(before);
  });
  it('continues identically from a save between hasted actions (T04)', async () => {
    const initial = createTwoRoomFixture(); initial.timing.hasted = true;
    const uninterrupted = new GameSession(initial);
    uninterrupted.submit({ expectedRevision: 0, action: { type: 'rest' } });
    const parsed = parseSave(serializeSave(uninterrupted.exportState()));
    if (!parsed.ok) throw new Error('expected valid save');
    const restored = restoreGame(parsed.value.state);
    uninterrupted.submit({ expectedRevision: 1, action: { type: 'rest' } });
    restored.submit({ expectedRevision: 1, action: { type: 'rest' } });
    expect(await hashState(restored.exportState())).toBe(await hashState(uninterrupted.exportState()));
  });
  it('preserves scheduler, RNG, knowledge, and counters', () => {
    const state = createTwoRoomFixture(); state.timing.noMove = 3;
    state.timing.scheduler.slots[0] = { effect: 'fixture', arg: 7, phase: 'after', remaining: 4 };
    state.timing.cycle = { phase: 'input', slotsRemaining: 1 };
    const parsed = parseSave(serializeSave(state)); if (!parsed.ok) throw new Error('expected valid save');
    expect(parsed.value.state).toEqual(state);
  });
  it('saves after forced turns and continues scheduled effects identically', async () => {
    const initial = createTwoRoomFixture(); initial.timing.noCommand = 2;
    initial.timing.scheduler.slots[0] = { effect: 'fixture', arg: 7, phase: 'after', remaining: 4 };
    const effect = { fixture: (state: ReturnType<typeof createTwoRoomFixture>) => { state.player.gold += 7; } };
    const uninterrupted = new GameSession(initial, { effects: effect });
    expect(uninterrupted.exportState().timing).toMatchObject({ tick: 2, noCommand: 0 });
    const parsed = parseSave(serializeSave(uninterrupted.exportState())); if (!parsed.ok) throw new Error('expected valid save');
    const restored = restoreGame(parsed.value.state, { effects: effect });
    for (let revision = 0; revision < 2; revision++) {
      const expected = uninterrupted.exportState().timing.revision;
      uninterrupted.submit({ expectedRevision: expected, action: { type: 'rest' } });
      restored.submit({ expectedRevision: expected, action: { type: 'rest' } });
    }
    expect(await hashState(restored.exportState())).toBe(await hashState(uninterrupted.exportState()));
  });
});

describe('canonical state', () => {
  it('sorts object keys while preserving array order and matches known SHA-256', async () => {
    expect(canonicalState({ b: 1, a: 2, nested: { z: 0, a: [2, 1] } }))
      .toBe('{"a":2,"b":1,"nested":{"a":[2,1],"z":0}}');
    expect(await hashState({ b: 1, a: 2 })).toBe('d3626ac30a87e6f7a6428233b3c68299976865fa5508e4267c5415c76af7a772');
  });
});
