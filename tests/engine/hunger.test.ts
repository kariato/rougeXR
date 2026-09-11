import { describe, expect, it } from 'vitest';
import { createTwoRoomFixture } from '../../src/debug/fixtures';
import { transferItem } from '../../src/engine/entities';
import { runStomach } from '../../src/engine/rules/hunger';
import { startDaemon } from '../../src/engine/scheduler';
import { GameSession } from '../../src/engine/session';
import { parseSave, restoreGame, serializeSave } from '../../src/persistence/save';

describe('food and hunger', () => {
  it('eats one ration, restores a bounded amount, and clears hunger', () => {
    const state = createTwoRoomFixture(22); const food = state.entities.e2;
    if (food?.kind !== 'item') throw new Error('missing item');
    food.category = 'food'; food.definitionId = 'food.ration'; food.quantity = 2;
    transferItem(state, food.id, { kind: 'pack', owner: 'player' });
    state.timing.foodLeft = -10; state.timing.hungerStage = 2;
    const beforeDraws = state.rng.draws; const session = new GameSession(state);
    const result = session.submit({ expectedRevision: 0, action: { type: 'eat', itemId: food.id } });
    expect(result).toMatchObject({ status: 'resolved', consumedSlot: true });
    const after = session.exportState(); expect(after.timing.foodLeft).toBeGreaterThanOrEqual(1100); expect(after.timing.foodLeft).toBeLessThanOrEqual(1499);
    expect(after.timing.hungerStage).toBe(0); expect(after.entities.e2).toMatchObject({ quantity: 1 });
    expect(after.rng.draws - beforeDraws).toBe(2);
  });

  it('emits threshold messages and starvation makes the cycle terminal', () => {
    const state = createTwoRoomFixture(); state.timing.foodLeft = 300; const events: any[] = [];
    runStomach(state, event => events.push(event)); expect(state.timing.foodLeft).toBe(299); expect(state.timing.hungerStage).toBe(1);
    expect(events).toContainEqual(expect.objectContaining({ type: 'sourceMessage', text: expect.stringContaining('hungry') }));
    state.timing.foodLeft = -851; runStomach(state, event => events.push(event));
    expect(state.timing.status).toBe('dead'); expect(state.player.stats.hp).toBe(0);
  });

  it('continues the stomach daemon identically after save and restore', () => {
    const state = createTwoRoomFixture(91); state.timing.foodLeft = 302; startDaemon(state.timing.scheduler, 'stomach', 0, 'after');
    const original = new GameSession(state); original.submit({ expectedRevision: 0, action: { type: 'rest' } });
    const parsed = parseSave(serializeSave(original.exportState())); if (!parsed.ok) throw new Error('save failed');
    const restored = restoreGame(parsed.value.state);
    original.submit({ expectedRevision: 1, action: { type: 'rest' } }); restored.submit({ expectedRevision: 1, action: { type: 'rest' } });
    expect(restored.exportState()).toEqual(original.exportState());
  });
});
