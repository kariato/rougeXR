import { describe, expect, it } from 'vitest';
import { createTwoRoomFixture } from '../../src/debug/fixtures';
import { allocateId } from '../../src/engine/entities';
import type { ItemState, WorldState } from '../../src/engine/model/state';
import { IS_CONFUSED, IS_HALLUCINATING } from '../../src/engine/rules/flags';
import { GameSession } from '../../src/engine/session';
import { ReplayRecorder, replay } from '../../src/persistence/replay';
import { restoreGame } from '../../src/persistence/save';

function addPotion(state: WorldState, quantity = 1): string {
  const id = allocateId(state);
  const item: ItemState = { kind: 'item', id, definitionId: 'potion.confuse', category: 'potion',
    location: { kind: 'pack', owner: 'player' }, quantity, flags: 0, group: 0, label: null };
  state.entities[id] = item; state.player.packOrder.push(id); return id;
}

describe('confusion potion', () => {
  it('consumes one dose, identifies it, and schedules source-duration recovery', () => {
    const state = createTwoRoomFixture(31); const itemId = addPotion(state, 2);
    const entry = state.identification.find(candidate => candidate.definitionId === 'potion.confuse')!;
    entry.called = 'swirly';
    const session = new GameSession(state);
    const result = session.submit({ expectedRevision: 0, action: { type: 'drink', itemId } });
    const after = session.exportState(); const fuse = after.timing.scheduler.slots.find(slot => slot?.effect === 'unconfuse');
    expect(result).toMatchObject({ status: 'resolved', consumedSlot: true });
    expect(after.player.flags & IS_CONFUSED).not.toBe(0);
    expect(after.entities[itemId]).toMatchObject({ quantity: 1 });
    expect(after.identification.find(candidate => candidate.definitionId === 'potion.confuse'))
      .toMatchObject({ known: true, called: null });
    expect(fuse?.remaining).toBeGreaterThanOrEqual(18); expect(fuse?.remaining).toBeLessThanOrEqual(19);
    expect(session.debugEvents()).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'identityLearned', definitionId: 'potion.confuse' }),
      expect.objectContaining({ type: 'itemConsumed', itemId, category: 'potion' }),
    ]));
  });

  it('lengthens confusion and preserves unknown identity while hallucinating', () => {
    const state = createTwoRoomFixture(32); const itemId = addPotion(state, 2);
    state.player.flags |= IS_HALLUCINATING | IS_CONFUSED;
    state.timing.scheduler.slots[0] = { effect: 'unconfuse', arg: 0, phase: 'after', remaining: 5 };
    const session = new GameSession(state);
    session.submit({ expectedRevision: 0, action: { type: 'drink', itemId } });
    const after = session.exportState(); const fuse = after.timing.scheduler.slots.find(slot => slot?.effect === 'unconfuse');
    expect(fuse?.remaining).toBeGreaterThanOrEqual(23); expect(fuse?.remaining).toBeLessThanOrEqual(24);
    expect(after.identification.find(candidate => candidate.definitionId === 'potion.confuse')?.known).toBe(false);
  });

  it('rejects non-potions without consuming a turn or item', () => {
    const state = createTwoRoomFixture(); const foodId = addPotion(state);
    const item = state.entities[foodId]; if (item?.kind !== 'item') throw new Error('missing item');
    item.category = 'food'; item.definitionId = 'food.ration'; const before = structuredClone(state);
    const session = new GameSession(state);
    const result = session.submit({ expectedRevision: 0, action: { type: 'drink', itemId: foodId } });
    expect(result).toMatchObject({ status: 'rejected', consumedSlot: false, reason: 'undrinkable' });
    expect(session.exportState()).toMatchObject({ entities: before.entities });
  });

  it('replays drinking and continues the saved fuse identically', async () => {
    const initial = createTwoRoomFixture(33); const itemId = addPotion(initial);
    const session = new GameSession(initial); const recorder = new ReplayRecorder(session.exportState());
    session.submit({ expectedRevision: 0, action: { type: 'drink', itemId } });
    await recorder.record({ type: 'drink', itemId }, 0, session.exportState());
    expect(await replay(recorder.bundle())).toEqual({ ok: true, completed: 1 });
    const restored = restoreGame(session.exportState());
    for (let revision = 1; revision <= 20; revision++) {
      session.submit({ expectedRevision: revision, action: { type: 'rest' } });
      restored.submit({ expectedRevision: revision, action: { type: 'rest' } });
    }
    expect(restored.exportState()).toEqual(session.exportState());
    expect(session.exportState().player.flags & IS_CONFUSED).toBe(0);
  });
});
