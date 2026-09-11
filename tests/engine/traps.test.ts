import { describe, expect, it } from 'vitest';
import { createTwoRoomFixture } from '../../src/debug/fixtures';
import { allocateId, transferItem } from '../../src/engine/entities';
import { cellIndex } from '../../src/engine/grid';
import type { TrapKind, WorldState } from '../../src/engine/model/state';
import { IS_LEVITATING } from '../../src/engine/rules/flags';
import { triggerTrap } from '../../src/engine/rules/traps';
import { GameSession } from '../../src/engine/session';
import { ReplayRecorder, replay } from '../../src/persistence/replay';

function trapped(kind: TrapKind, seed = 5): WorldState {
  const state = createTwoRoomFixture(seed); state.level.tiles[cellIndex(state.level, { x: 6, y: 5 })]!.feature = { kind: 'trap', trap: kind, revealed: false }; return state;
}

describe('trap handlers', () => {
  it('reveals bear traps, applies noMove, and levitation bypasses hidden traps', () => {
    const state = trapped('bear'); triggerTrap(state, { x: 6, y: 5 }, () => {});
    expect(state.timing.noMove).toBe(3); expect(state.level.tiles[cellIndex(state.level, { x: 6, y: 5 })]!.feature).toMatchObject({ revealed: true });
    const floating = trapped('bear'); floating.player.flags |= IS_LEVITATING; triggerTrap(floating, { x: 6, y: 5 }, () => {});
    expect(floating.timing.noMove).toBe(0); expect(floating.level.tiles[cellIndex(floating.level, { x: 6, y: 5 })]!.feature).toMatchObject({ revealed: false });
  });
  it('applies sleep and executes arrow, dart, and mystery RNG paths', () => {
    const sleep = trapped('sleep'); triggerTrap(sleep, { x: 6, y: 5 }, () => {}); expect(sleep.timing.noCommand).toBe(5);
    for (const kind of ['arrow', 'dart', 'mystery'] as const) {
      const state = trapped(kind, 17); const before = state.rng.draws; triggerTrap(state, { x: 6, y: 5 }, () => {});
      expect(state.rng.draws).toBeGreaterThan(before); expect(state.level.tiles[cellIndex(state.level, { x: 6, y: 5 })]!.feature).toMatchObject({ revealed: true });
    }
  });
  it('rusts eligible worn armor', () => {
    const state = trapped('rust'); const id = allocateId(state);
    state.entities[id] = { kind: 'item', id, definitionId: 'armor.chain', category: 'armor', location: { kind: 'floor', levelId: 1, at: { x: 7, y: 5 } }, quantity: 1, flags: 0, group: 0, label: null, armorClass: 5 };
    state.level.floorObjectOrder.push(id); transferItem(state, id, { kind: 'pack', owner: 'player' }); state.player.equipment.armor = id;
    triggerTrap(state, { x: 6, y: 5 }, () => {}); expect(state.entities[id]).toMatchObject({ armorClass: 6 });
  });
  it('rejects teleport and trap-door movement before mutating position', () => {
    for (const kind of ['teleport', 'trapDoor'] as const) {
      const session = new GameSession(trapped(kind)); const result = session.submit({ expectedRevision: 0, action: { type: 'move', direction: 'E', pickup: true } });
      expect(result).toMatchObject({ status: 'rejected', consumedSlot: false, reason: `unsupported-trap:${kind}` }); expect(session.exportState().player.at).toEqual({ x: 5, y: 5 });
    }
  });
  it('keeps firing after being revealed instead of becoming permanently disarmed', () => {
    const state = trapped('bear'); triggerTrap(state, { x: 6, y: 5 }, () => {});
    const afterFirst = state.timing.noMove; expect(afterFirst).toBeGreaterThan(0);
    triggerTrap(state, { x: 6, y: 5 }, () => {}); expect(state.timing.noMove).toBeGreaterThan(afterFirst);
  });
  it('only emits featureRevealed once across repeated triggers', () => {
    const state = trapped('bear'); const events: Array<{ type: string }> = [];
    triggerTrap(state, { x: 6, y: 5 }, e => events.push(e)); triggerTrap(state, { x: 6, y: 5 }, e => events.push(e));
    expect(events.filter(e => e.type === 'featureRevealed')).toHaveLength(1);
  });
  it('replays a trap trigger with identical state hashes', async () => {
    const session = new GameSession(trapped('dart', 42)); const recorder = new ReplayRecorder(session.exportState());
    const action = { type: 'move', direction: 'E', pickup: true } as const; session.submit({ expectedRevision: 0, action });
    await recorder.record(action, 0, session.exportState()); expect(await replay(recorder.bundle())).toEqual({ ok: true, completed: 1 });
  });
});
