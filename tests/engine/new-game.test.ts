import { describe, expect, it } from 'vitest';
import { createNewGame } from '../../src/engine/new-game';
import { GameSession } from '../../src/engine/session';
import { validateWorld } from '../../src/engine/validate';
import { ReplayRecorder, replay } from '../../src/persistence/replay';
import { parseSave, serializeSave } from '../../src/persistence/save';

describe('production new game', () => {
  it('is reproducible and valid at its first input boundary', () => {
    const left = new GameSession(createNewGame(12345)); const right = new GameSession(createNewGame(12345));
    expect(left.exportState()).toEqual(right.exportState()); expect(validateWorld(left.exportState())).toEqual([]);
    expect(left.exportState().timing.cycle).toEqual({ phase: 'input', slotsRemaining: 1 });
    expect(parseSave(serializeSave(left.exportState()))).toMatchObject({ ok: true });
  });
  it('creates the source starting pack and equipment with stable IDs', () => {
    const state = createNewGame(7); expect(state.player.packOrder).toEqual(['e1', 'e2', 'e3', 'e4', 'e5']);
    expect(state.entities.e1).toMatchObject({ definitionId: 'food.ration', category: 'food', quantity: 1 });
    expect(state.entities.e2).toMatchObject({ definitionId: 'armor.ring-mail', armorClass: 6 });
    expect(state.entities.e3).toMatchObject({ definitionId: 'weapon.mace', hitBonus: 1, damageBonus: 1 });
    expect(state.entities.e4).toMatchObject({ definitionId: 'weapon.short-bow', hitBonus: 1 });
    expect(state.entities.e5).toMatchObject({ definitionId: 'weapon.arrow', quantity: expect.any(Number), group: 1 });
    expect(state.player.equipment).toMatchObject({ armor: 'e2', weapon: 'e3' });
    expect((state.entities.e5 as { quantity: number }).quantity).toBeGreaterThanOrEqual(25);
    expect((state.entities.e5 as { quantity: number }).quantity).toBeLessThanOrEqual(39);
  });
  it('registers production timing effects in source allocation order', () => {
    const slots = createNewGame(9).timing.scheduler.slots.filter(entry => entry !== null);
    expect(slots.map(entry => `${entry!.effect}:${entry!.phase}`)).toEqual(['runners:after', 'doctor:after', 'swander:after', 'stomach:after']);
    expect(slots[2]!.remaining).toBeGreaterThanOrEqual(67); expect(slots[2]!.remaining).toBeLessThanOrEqual(73);
  });
  it('replays the first generated turn from the production boundary', async () => {
    const session = new GameSession(createNewGame(818)); const recorder = new ReplayRecorder(session.exportState());
    session.submit({ expectedRevision: 0, action: { type: 'rest' } }); await recorder.record({ type: 'rest' }, 0, session.exportState());
    expect(await replay(recorder.bundle())).toEqual({ ok: true, completed: 1 });
  });
});
