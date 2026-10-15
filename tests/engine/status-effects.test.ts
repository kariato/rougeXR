import { expect, it } from 'vitest';
import { createNewGame } from '../../src/engine/new-game';
import { observe } from '../../src/engine/perception/knowledge';
import { GameSession } from '../../src/engine/session';
import { IS_CURSED, IS_BLIND, IS_CONFUSED, IS_HELD } from '../../src/engine/rules/flags';
import { allocateId } from '../../src/engine/entities';
import { parseSave, serializeSave } from '../../src/persistence/save';
import { observedStatusEffects } from '../../src/presentation/three/status-effects';

it('does not reveal curses until equipment is identified or removal is attempted', () => {
  const state = createNewGame(12345), id = state.player.equipment.weapon!;
  state.entities[id]!.flags = IS_CURSED;
  expect(observe(state).inventory.find(item => item.token === id)?.knownCursed).toBe(false);
  expect(observedStatusEffects(observe(state)).some(effect => effect.id.startsWith('curse-'))).toBe(false);
  const session = new GameSession(state);
  expect(session.submit({ expectedRevision: 0, action: { type: 'unequip', slot: 'weapon' } }).reason).toBe('cursed');
  expect(observedStatusEffects(observe(session.exportState())).some(effect => effect.label === 'Cursed equipment')).toBe(true);
  const saved = parseSave(serializeSave(session.exportState())); expect(saved.ok).toBe(true);
  if (!saved.ok) throw new Error('Invalid save');
  expect(saved.value.state.entities[id]!.curseKnown).toBe(true);
  saved.value.state.entities[id]!.flags &= ~IS_CURSED;
  expect(observedStatusEffects(observe(saved.value.state)).some(effect => effect.id.startsWith('curse-'))).toBe(false);
});
it('reports poisoned strength loss and clears the badge after restoration', () => {
  const state = createNewGame(12345);
  const addPotion = (definitionId: string) => {
    const id = allocateId(state); state.entities[id] = { kind: 'item', id, category: 'potion', definitionId,
      location: { kind: 'pack', owner: 'player' }, quantity: 1, flags: 0, group: 0, label: null }; state.player.packOrder.push(id); return id;
  };
  const poison = addPotion('potion.poison'), restore = addPotion('potion.restore-strength');
  const session = new GameSession(state);
  session.submit({ expectedRevision: 0, action: { type: 'drink', itemId: poison } });
  expect(observe(session.exportState()).status.conditions).toContain('Poisoned');
  session.submit({ expectedRevision: 1, action: { type: 'drink', itemId: restore } });
  expect(observe(session.exportState()).status.conditions).not.toContain('Poisoned');
});
it('explains confusion, blindness, holding and severe hunger', () => {
  const state = createNewGame(12345); state.player.flags |= IS_BLIND | IS_CONFUSED | IS_HELD; state.timing.hungerStage = 3;
  const effects = observedStatusEffects(observe(state));
  expect(effects.map(effect => effect.id)).toEqual(expect.arrayContaining(['Blind', 'Confused', 'Held', 'Hunger']));
  expect(effects.every(effect => effect.icon && effect.description.length > 20)).toBe(true);
});
