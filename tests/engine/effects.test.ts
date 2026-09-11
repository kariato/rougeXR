import { describe, expect, it } from 'vitest';
import { createTwoRoomFixture } from '../../src/debug/fixtures';
import { allocateId } from '../../src/engine/entities';
import { recoverConfusion, recoverSight, runDoctor } from '../../src/engine/rules/effects';
import { IS_BLIND, IS_CONFUSED } from '../../src/engine/rules/flags';
import { scheduleFuse, startDaemon } from '../../src/engine/scheduler';
import { GameSession } from '../../src/engine/session';
import { restoreGame } from '../../src/persistence/save';

describe('healing and timed recovery', () => {
  it('uses the source quiet threshold and resets quiet after healing', () => {
    const state = createTwoRoomFixture(); state.player.stats.hp = 5; state.timing.quiet = 18;
    const events: any[] = []; runDoctor(state, event => events.push(event));
    expect(state.player.stats.hp).toBe(6); expect(state.timing.quiet).toBe(0);
    expect(events).toContainEqual(expect.objectContaining({ type: 'hpChanged', from: 5, to: 6 }));
  });

  it('adds one point for each equipped regeneration ring and caps max HP', () => {
    const state = createTwoRoomFixture(); state.player.stats.hp = 8;
    for (const slot of ['leftRing', 'rightRing'] as const) {
      const id = allocateId(state); state.entities[id] = { kind: 'item', id, definitionId: 'ring.regeneration', category: 'ring',
        location: { kind: 'pack', owner: 'player' }, quantity: 1, flags: 0, group: 0, label: null, magnitude: 0 };
      state.player.packOrder.push(id); state.player.equipment[slot] = id;
    }
    runDoctor(state, () => {}); expect(state.player.stats.hp).toBe(10); expect(state.timing.quiet).toBe(0);
  });

  it('clears saved blindness and confusion when their fuses expire', () => {
    const state = createTwoRoomFixture(); state.player.flags = IS_BLIND | IS_CONFUSED;
    recoverConfusion(state, () => {}); expect(state.player.flags & IS_CONFUSED).toBe(0); expect(state.player.flags & IS_BLIND).not.toBe(0);
    recoverSight(state, () => {}); expect(state.player.flags & IS_BLIND).toBe(0);
  });

  it('continues doctor and recovery schedules identically after restore', () => {
    const state = createTwoRoomFixture(12); state.player.stats.hp = 4; state.timing.quiet = 17; state.player.flags |= IS_CONFUSED;
    startDaemon(state.timing.scheduler, 'doctor', 0, 'after'); scheduleFuse(state.timing.scheduler, 'unconfuse', 0, 'after', 2);
    const original = new GameSession(state); const restored = restoreGame(original.exportState());
    for (let revision = 0; revision < 2; revision++) {
      original.submit({ expectedRevision: revision, action: { type: 'rest' } }); restored.submit({ expectedRevision: revision, action: { type: 'rest' } });
    }
    expect(restored.exportState()).toEqual(original.exportState()); expect(original.exportState().player.flags & IS_CONFUSED).toBe(0);
  });
});
