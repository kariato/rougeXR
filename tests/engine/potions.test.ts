import { describe, expect, it } from 'vitest';
import { createTwoRoomFixture } from '../../src/debug/fixtures';
import { allocateId } from '../../src/engine/entities';
import type { ItemState, WorldState } from '../../src/engine/model/state';
import { IS_BLIND, IS_CONFUSED, IS_HALLUCINATING, IS_HASTED, IS_LEVITATING } from '../../src/engine/rules/flags';
import { GameSession } from '../../src/engine/session';
import { ReplayRecorder, replay } from '../../src/persistence/replay';
import { parseSave, restoreGame, serializeSave } from '../../src/persistence/save';
import { roll } from '../../src/engine/random';
import { triggerTrap } from '../../src/engine/rules/traps';
import { cellIndex } from '../../src/engine/grid';
import { observe } from '../../src/engine/perception/knowledge';
import { CAN_SEE_INVISIBLE, IS_INVISIBLE } from '../../src/engine/rules/flags';

function addPotion(state: WorldState, quantity = 1, definitionId = 'potion.confuse'): string {
  const id = allocateId(state);
  const item: ItemState = { kind: 'item', id, definitionId, category: 'potion',
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

describe('poison potion', () => {
  it('identifies poison, draws a 1–3 loss, clamps strength, and ends hallucination', () => {
    const state = createTwoRoomFixture(41); const itemId = addPotion(state, 1, 'potion.poison');
    state.player.stats.strength = 4; state.player.flags |= IS_HALLUCINATING; const draws = state.rng.draws;
    const session = new GameSession(state);
    const result = session.submit({ expectedRevision: 0, action: { type: 'drink', itemId } }); const after = session.exportState();
    expect(result).toMatchObject({ status: 'resolved', consumedSlot: true });
    expect(after.player.stats.strength).toBe(3); expect(after.player.flags & IS_HALLUCINATING).toBe(0);
    expect(after.rng.draws).toBe(draws + 1); expect(after.entities[itemId]).toBeUndefined();
    expect(after.identification.find(candidate => candidate.definitionId === 'potion.poison')).toMatchObject({ known: true, called: null });
  });

  it('lets sustain strength prevent the loss and RNG draw', () => {
    const state = createTwoRoomFixture(42); const itemId = addPotion(state, 1, 'potion.poison');
    const ringId = allocateId(state); state.entities[ringId] = { kind: 'item', id: ringId, definitionId: 'ring.sustain-strength', category: 'ring',
      location: { kind: 'pack', owner: 'player' }, quantity: 1, flags: 0, group: 0, label: null, magnitude: 0 };
    state.player.packOrder.push(ringId); state.player.equipment.leftRing = ringId;
    const strength = state.player.stats.strength; const draws = state.rng.draws; state.player.flags |= IS_HALLUCINATING;
    const session = new GameSession(state); session.submit({ expectedRevision: 0, action: { type: 'drink', itemId } }); const after = session.exportState();
    expect(after.player.stats.strength).toBe(strength); expect(after.rng.draws).toBe(draws);
    expect(after.player.flags & IS_HALLUCINATING).not.toBe(0);
  });

  it('replays and restores the resulting poison state exactly', async () => {
    const initial = createTwoRoomFixture(43); const itemId = addPotion(initial, 1, 'potion.poison');
    const session = new GameSession(initial); const recorder = new ReplayRecorder(session.exportState());
    session.submit({ expectedRevision: 0, action: { type: 'drink', itemId } });
    await recorder.record({ type: 'drink', itemId }, 0, session.exportState());
    expect(await replay(recorder.bundle())).toEqual({ ok: true, completed: 1 });
    expect(restoreGame(session.exportState()).exportState()).toEqual(session.exportState());
  });
});

describe('gain-strength potion', () => {
  it('raises current and maximum base strength and identifies the potion', () => {
    const state = createTwoRoomFixture(51); const itemId = addPotion(state, 1, 'potion.strength');
    state.player.stats.strength = 10; state.player.maximumStrength = 10;
    const session = new GameSession(state); session.submit({ expectedRevision: 0, action: { type: 'drink', itemId } }); const after = session.exportState();
    expect(after.player).toMatchObject({ maximumStrength: 11, stats: { strength: 11 } });
    expect(after.identification.find(candidate => candidate.definitionId === 'potion.strength')).toMatchObject({ known: true, called: null });
    expect(after.entities[itemId]).toBeUndefined();
  });

  it('tracks maximum strength beneath equipped add-strength rings and clamps at 31', () => {
    const state = createTwoRoomFixture(52); const itemId = addPotion(state, 2, 'potion.strength');
    const ringId = allocateId(state); state.entities[ringId] = { kind: 'item', id: ringId, definitionId: 'ring.add-strength', category: 'ring',
      location: { kind: 'pack', owner: 'player' }, quantity: 1, flags: 0, group: 0, label: null, magnitude: 2 };
    state.player.packOrder.push(ringId); state.player.equipment.leftRing = ringId;
    state.player.stats.strength = 12; state.player.maximumStrength = 10;
    const session = new GameSession(state); session.submit({ expectedRevision: 0, action: { type: 'drink', itemId } });
    expect(session.exportState().player).toMatchObject({ maximumStrength: 11, stats: { strength: 13 } });
    const capped = session.exportState(); capped.player.stats.strength = 31; capped.player.maximumStrength = 31;
    const cappedSession = new GameSession(capped); cappedSession.submit({ expectedRevision: 1, action: { type: 'drink', itemId } });
    expect(cappedSession.exportState().player).toMatchObject({ maximumStrength: 31, stats: { strength: 31 } });
  });

  it('replays and restores maximum-strength state', async () => {
    const initial = createTwoRoomFixture(53); const itemId = addPotion(initial, 1, 'potion.strength');
    const session = new GameSession(initial); const recorder = new ReplayRecorder(session.exportState());
    session.submit({ expectedRevision: 0, action: { type: 'drink', itemId } });
    await recorder.record({ type: 'drink', itemId }, 0, session.exportState());
    expect(await replay(recorder.bundle())).toEqual({ ok: true, completed: 1 });
    expect(restoreGame(session.exportState()).exportState()).toEqual(session.exportState());
  });
});

describe('healing potion', () => {
  it('raises maximum HP exactly once on overflow and restores sight', () => {
    const state = createTwoRoomFixture(61); const itemId = addPotion(state, 1, 'potion.healing');
    state.player.stats.hp = 10; state.player.stats.maxHp = 10; state.player.flags |= IS_BLIND;
    state.timing.scheduler.slots[0] = { effect: 'sight', arg: 0, phase: 'after', remaining: 8 };
    const draws = state.rng.draws; const session = new GameSession(state);
    session.submit({ expectedRevision: 0, action: { type: 'drink', itemId } }); const after = session.exportState();
    expect(after.player.stats).toMatchObject({ hp: 11, maxHp: 11 }); expect(after.rng.draws).toBe(draws + 1);
    expect(after.player.flags & IS_BLIND).toBe(0); expect(after.timing.scheduler.slots.some(slot => slot?.effect === 'sight')).toBe(false);
    expect(after.identification.find(candidate => candidate.definitionId === 'potion.healing')).toMatchObject({ known: true, called: null });
  });

  it('rolls one d4 per level without raising maximum HP below the cap', () => {
    const state = createTwoRoomFixture(62); const itemId = addPotion(state, 1, 'potion.healing');
    state.player.stats.level = 3; state.player.stats.hp = 1; state.player.stats.maxHp = 20; const draws = state.rng.draws;
    const session = new GameSession(state); session.submit({ expectedRevision: 0, action: { type: 'drink', itemId } }); const after = session.exportState();
    expect(after.rng.draws).toBe(draws + 3); expect(after.player.stats.maxHp).toBe(20);
    expect(after.player.stats.hp).toBeGreaterThanOrEqual(4); expect(after.player.stats.hp).toBeLessThanOrEqual(13);
  });

  it('replays and restores healing and sight changes exactly', async () => {
    const initial = createTwoRoomFixture(63); const itemId = addPotion(initial, 1, 'potion.healing');
    initial.player.stats.hp = 4; initial.player.flags |= IS_BLIND;
    initial.timing.scheduler.slots[0] = { effect: 'sight', arg: 0, phase: 'after', remaining: 4 };
    const session = new GameSession(initial); const recorder = new ReplayRecorder(session.exportState());
    session.submit({ expectedRevision: 0, action: { type: 'drink', itemId } });
    await recorder.record({ type: 'drink', itemId }, 0, session.exportState());
    expect(await replay(recorder.bundle())).toEqual({ ok: true, completed: 1 });
    expect(restoreGame(session.exportState()).exportState()).toEqual(session.exportState());
  });
});

describe('blindness potion', () => {
  it('identifies blindness and schedules source-duration sight recovery', () => {
    const state = createTwoRoomFixture(71); const itemId = addPotion(state, 2, 'potion.blindness'); const draws = state.rng.draws;
    const session = new GameSession(state); session.submit({ expectedRevision: 0, action: { type: 'drink', itemId } }); const after = session.exportState();
    const fuse = after.timing.scheduler.slots.find(slot => slot?.effect === 'sight');
    expect(after.player.flags & IS_BLIND).not.toBe(0); expect(after.rng.draws).toBe(draws + 1);
    expect(fuse?.remaining).toBeGreaterThanOrEqual(807); expect(fuse?.remaining).toBeLessThanOrEqual(891);
    expect(after.entities[itemId]).toMatchObject({ quantity: 1 });
    expect(after.identification.find(candidate => candidate.definitionId === 'potion.blindness')).toMatchObject({ known: true, called: null });
  });

  it('lengthens an existing sight fuse and uses the hallucination message', () => {
    const state = createTwoRoomFixture(72); const itemId = addPotion(state, 1, 'potion.blindness');
    state.player.flags |= IS_BLIND | IS_HALLUCINATING;
    state.timing.scheduler.slots[0] = { effect: 'sight', arg: 0, phase: 'after', remaining: 10 };
    const session = new GameSession(state); const result = session.submit({ expectedRevision: 0, action: { type: 'drink', itemId } });
    const after = session.exportState(); const fuse = after.timing.scheduler.slots.find(slot => slot?.effect === 'sight');
    expect(fuse?.remaining).toBeGreaterThanOrEqual(817); expect(fuse?.remaining).toBeLessThanOrEqual(901);
    expect(result.events).toContainEqual({ type: 'message', text: 'Oh, bummer! Everything is dark! Help!' });
  });

  it('replays blindness and preserves its recovery fuse through restore', async () => {
    const initial = createTwoRoomFixture(73); const itemId = addPotion(initial, 1, 'potion.blindness');
    const session = new GameSession(initial); const recorder = new ReplayRecorder(session.exportState());
    session.submit({ expectedRevision: 0, action: { type: 'drink', itemId } });
    await recorder.record({ type: 'drink', itemId }, 0, session.exportState());
    expect(await replay(recorder.bundle())).toEqual({ ok: true, completed: 1 });
    const restored = restoreGame(session.exportState());
    for (let revision = 1; revision <= 3; revision++) {
      session.submit({ expectedRevision: revision, action: { type: 'rest' } });
      restored.submit({ expectedRevision: revision, action: { type: 'rest' } });
    }
    expect(restored.exportState()).toEqual(session.exportState());
  });
});

describe('extra-healing potion', () => {
  it('uses level d8s, raises maximum HP once or twice, and clears visual effects', () => {
    const state = createTwoRoomFixture(81); const itemId = addPotion(state, 1, 'potion.extra-healing');
    state.player.stats.hp = 10; state.player.stats.maxHp = 10; state.player.stats.level = 1;
    state.player.flags |= IS_BLIND | IS_HALLUCINATING;
    state.timing.scheduler.slots[0] = { effect: 'sight', arg: 0, phase: 'after', remaining: 8 };
    const expectedRng = structuredClone(state.rng); const amount = roll(expectedRng, 1, 8);
    const session = new GameSession(state); session.submit({ expectedRevision: 0, action: { type: 'drink', itemId } }); const after = session.exportState();
    const expectedMaximum = 11 + (amount > 2 ? 1 : 0);
    expect(after.player.stats).toMatchObject({ hp: expectedMaximum, maxHp: expectedMaximum });
    expect(after.player.flags & (IS_BLIND | IS_HALLUCINATING)).toBe(0);
    expect(after.identification.find(candidate => candidate.definitionId === 'potion.extra-healing')?.known).toBe(true);
  });

  it('replays and restores extra healing exactly', async () => {
    const initial = createTwoRoomFixture(82); const itemId = addPotion(initial, 1, 'potion.extra-healing'); initial.player.stats.hp = 3;
    const session = new GameSession(initial); const recorder = new ReplayRecorder(session.exportState());
    session.submit({ expectedRevision: 0, action: { type: 'drink', itemId } });
    await recorder.record({ type: 'drink', itemId }, 0, session.exportState());
    expect(await replay(recorder.bundle())).toEqual({ ok: true, completed: 1 });
    expect(restoreGame(session.exportState()).exportState()).toEqual(session.exportState());
  });
});

describe('haste potion', () => {
  it('is a free command and starts 4–7 turns of haste', () => {
    const state = createTwoRoomFixture(91); const itemId = addPotion(state, 1, 'potion.haste'); const draws = state.rng.draws;
    const session = new GameSession(state); const result = session.submit({ expectedRevision: 0, action: { type: 'drink', itemId } }); const after = session.exportState();
    const fuse = after.timing.scheduler.slots.find(slot => slot?.effect === 'nohaste');
    expect(result).toMatchObject({ status: 'resolved', consumedSlot: false, ticksAdvanced: 0 });
    expect(after.timing).toMatchObject({ hasted: true, tick: 0, cycle: { phase: 'input', slotsRemaining: 1 } });
    expect(after.player.flags & IS_HASTED).not.toBe(0); expect(after.rng.draws).toBe(draws + 1);
    expect(fuse?.remaining).toBeGreaterThanOrEqual(4); expect(fuse?.remaining).toBeLessThanOrEqual(7);
  });

  it('cancels haste and its fuse on a second dose, then resolves forced rests', () => {
    const state = createTwoRoomFixture(92); const itemId = addPotion(state, 2, 'potion.haste'); const session = new GameSession(state);
    session.submit({ expectedRevision: 0, action: { type: 'drink', itemId } });
    const result = session.submit({ expectedRevision: 1, action: { type: 'drink', itemId } }); const after = session.exportState();
    expect(result.consumedSlot).toBe(false); expect(after.timing.hasted).toBe(false); expect(after.timing.noCommand).toBe(0);
    expect(after.timing.scheduler.slots.some(slot => slot?.effect === 'nohaste')).toBe(false);
  });

  it('replays and preserves the haste fuse through restore', async () => {
    const initial = createTwoRoomFixture(93); const itemId = addPotion(initial, 1, 'potion.haste');
    const session = new GameSession(initial); const recorder = new ReplayRecorder(session.exportState());
    session.submit({ expectedRevision: 0, action: { type: 'drink', itemId } });
    await recorder.record({ type: 'drink', itemId }, 0, session.exportState());
    expect(await replay(recorder.bundle())).toEqual({ ok: true, completed: 1 });
    const restored = restoreGame(session.exportState());
    for (let step = 0; step < 15 && session.exportState().timing.hasted; step++) {
      const revision = session.exportState().timing.revision;
      session.submit({ expectedRevision: revision, action: { type: 'rest' } });
      restored.submit({ expectedRevision: revision, action: { type: 'rest' } });
    }
    expect(restored.exportState()).toEqual(session.exportState());
    expect(session.exportState().timing.hasted).toBe(false); expect(session.exportState().player.flags & IS_HASTED).toBe(0);
  });
});

describe('levitation potion', () => {
  it('schedules landing and prevents floor traps while active', () => {
    const state = createTwoRoomFixture(101); const itemId = addPotion(state, 1, 'potion.levitation');
    const session = new GameSession(state); session.submit({ expectedRevision: 0, action: { type: 'drink', itemId } }); const after = session.exportState();
    const fuse = after.timing.scheduler.slots.find(slot => slot?.effect === 'land');
    expect(after.player.flags & IS_LEVITATING).not.toBe(0); expect(fuse?.remaining).toBeGreaterThanOrEqual(28); expect(fuse?.remaining).toBeLessThanOrEqual(30);
    const tile = after.level.tiles[cellIndex(after.level, after.player.at)]!;
    tile.feature = { kind: 'trap', trap: 'bear', revealed: false }; triggerTrap(after, after.player.at, () => {});
    expect(tile.feature.revealed).toBe(false); expect(after.timing.noMove).toBe(0);
  });

  it('lengthens levitation and preserves its landing fuse through restore', () => {
    const state = createTwoRoomFixture(102); const itemId = addPotion(state, 2, 'potion.levitation'); const session = new GameSession(state);
    session.submit({ expectedRevision: 0, action: { type: 'drink', itemId } });
    session.submit({ expectedRevision: 1, action: { type: 'drink', itemId } }); const after = session.exportState();
    const fuse = after.timing.scheduler.slots.find(slot => slot?.effect === 'land');
    expect(fuse?.remaining).toBeGreaterThanOrEqual(56); expect(fuse?.remaining).toBeLessThanOrEqual(60);
    const restored = restoreGame(after);
    for (let step = 0; step < 61 && session.exportState().player.flags & IS_LEVITATING; step++) {
      const revision = session.exportState().timing.revision;
      session.submit({ expectedRevision: revision, action: { type: 'rest' } });
      restored.submit({ expectedRevision: revision, action: { type: 'rest' } });
    }
    expect(restored.exportState()).toEqual(session.exportState());
    expect(session.exportState().player.flags & IS_LEVITATING).toBe(0);
  });
});

describe('serialized call-item decisions and non-identifying potions', () => {
  it('pauses before AFTER, saves, names see-invisible, and resumes its fuse', async () => {
    const initial = createTwoRoomFixture(111); const itemId = addPotion(initial, 1, 'potion.see-invisible');
    initial.player.flags |= IS_BLIND; initial.timing.scheduler.slots[0] = { effect: 'sight', arg: 0, phase: 'after', remaining: 9 };
    const monster = initial.entities.e1; if (monster?.kind !== 'monster') throw new Error('missing monster');
    monster.at = { x: 6, y: 5 }; monster.roomId = 0; monster.flags |= IS_INVISIBLE;
    const session = new GameSession(initial); const recorder = new ReplayRecorder(session.exportState());
    const drink = session.submit({ expectedRevision: 0, action: { type: 'drink', itemId } });
    await recorder.record({ type: 'drink', itemId }, 0, session.exportState()); const pending = session.exportState();
    expect(drink).toMatchObject({ consumedSlot: true, ticksAdvanced: 0 });
    expect(pending.timing).toMatchObject({ tick: 0, cycle: { phase: 'decision', slotsRemaining: 0 } });
    expect(pending.pendingDecision).toEqual({ kind: 'callItem', definitionId: 'potion.see-invisible' });
    expect(pending.player.flags & CAN_SEE_INVISIBLE).not.toBe(0); expect(pending.player.flags & IS_BLIND).toBe(0);
    expect(observe(pending).entities).toContainEqual(expect.objectContaining({ token: 'monster-e1' }));
    const saved = parseSave(serializeSave(pending)); expect(saved.ok).toBe(true);
    if (!saved.ok) throw new Error('expected decision save'); const restored = restoreGame(saved.value.state);
    const answer = session.submit({ expectedRevision: 1, action: { type: 'answerCall', label: 'vision' } });
    restored.submit({ expectedRevision: 1, action: { type: 'answerCall', label: 'vision' } });
    await recorder.record({ type: 'answerCall', label: 'vision' }, 1, session.exportState());
    expect(answer.ticksAdvanced).toBe(1); expect(restored.exportState()).toEqual(session.exportState());
    expect(session.exportState().identification.find(entry => entry.definitionId === 'potion.see-invisible'))
      .toMatchObject({ known: false, called: 'vision' });
    expect(await replay(recorder.bundle())).toEqual({ ok: true, completed: 2 });
  });

  it('blocks game commands until a call is answered or cancelled', () => {
    const state = createTwoRoomFixture(112); const itemId = addPotion(state, 1, 'potion.restore-strength'); const session = new GameSession(state);
    session.submit({ expectedRevision: 0, action: { type: 'drink', itemId } });
    const rejected = session.submit({ expectedRevision: 1, action: { type: 'rest' } });
    expect(rejected).toMatchObject({ status: 'rejected', consumedSlot: false, reason: 'decision-pending', ticksAdvanced: 0 });
    expect(session.exportState().pendingDecision).not.toBeNull();
    session.submit({ expectedRevision: 2, action: { type: 'answerCall', label: null } });
    expect(session.exportState().pendingDecision).toBeNull();
  });

  it('restores base strength beneath add-strength rings without identifying the potion', () => {
    const state = createTwoRoomFixture(113); const itemId = addPotion(state, 1, 'potion.restore-strength');
    const ringId = allocateId(state); state.entities[ringId] = { kind: 'item', id: ringId, definitionId: 'ring.add-strength', category: 'ring',
      location: { kind: 'pack', owner: 'player' }, quantity: 1, flags: 0, group: 0, label: null, magnitude: 2 };
    state.player.packOrder.push(ringId); state.player.equipment.leftRing = ringId;
    state.player.stats.strength = 5; state.player.maximumStrength = 10;
    const session = new GameSession(state); session.submit({ expectedRevision: 0, action: { type: 'drink', itemId } });
    const pending = session.exportState(); expect(pending.player.stats.strength).toBe(12);
    expect(pending.identification.find(entry => entry.definitionId === 'potion.restore-strength')?.known).toBe(false);
    expect(pending.pendingDecision?.definitionId).toBe('potion.restore-strength');
  });

  it('does not prompt again when an unknown potion already has a call name', () => {
    const state = createTwoRoomFixture(114); const itemId = addPotion(state, 1, 'potion.restore-strength');
    state.identification.find(entry => entry.definitionId === 'potion.restore-strength')!.called = 'tonic';
    const session = new GameSession(state); const result = session.submit({ expectedRevision: 0, action: { type: 'drink', itemId } });
    expect(result.ticksAdvanced).toBe(1); expect(session.exportState().pendingDecision).toBeNull();
  });
});
