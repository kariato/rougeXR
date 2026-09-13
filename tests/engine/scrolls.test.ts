import { describe, expect, it } from 'vitest';
import { createTwoRoomFixture } from '../../src/debug/fixtures';
import { allocateId } from '../../src/engine/entities';
import type { ItemState, WorldState } from '../../src/engine/model/state';
import { CAN_CONFUSE_MONSTER, IS_CURSED, IS_HELD, IS_PROTECTED, IS_RUNNING } from '../../src/engine/rules/flags';
import { GameSession } from '../../src/engine/session';
import { ReplayRecorder, replay } from '../../src/persistence/replay';
import { restoreGame } from '../../src/persistence/save';

function addScroll(state: WorldState, definitionId: string, quantity = 1): string {
  const id = allocateId(state); const item: ItemState = { kind: 'item', id, definitionId, category: 'scroll',
    location: { kind: 'pack', owner: 'player' }, quantity, flags: 0, group: 0, label: null };
  state.entities[id] = item; state.player.packOrder.push(id); return id;
}

describe('scroll reading foundation and status effects', () => {
  it('uses generated titles, consumes a scroll, and serializes its call decision', async () => {
    const initial = createTwoRoomFixture(201); const itemId = addScroll(initial, 'scroll.monster-confusion');
    const entry = initial.identification.find(value => value.definitionId === 'scroll.monster-confusion')!;
    expect(entry.appearanceId.split(' ').length).toBeGreaterThanOrEqual(2);
    const session = new GameSession(initial); const recorder = new ReplayRecorder(session.exportState());
    session.submit({ expectedRevision: 0, action: { type: 'read', itemId } }); await recorder.record({ type: 'read', itemId }, 0, session.exportState());
    const after = session.exportState(); expect(after.player.flags & CAN_CONFUSE_MONSTER).not.toBe(0);
    expect(after.pendingDecision?.definitionId).toBe('scroll.monster-confusion'); expect(after.entities[itemId]).toBeUndefined();
    expect(restoreGame(after).exportState()).toEqual(after); expect(await replay(recorder.bundle())).toEqual({ ok: true, completed: 1 });
  });

  it('holds only running monsters within the source two-cell square', () => {
    const state = createTwoRoomFixture(202); const itemId = addScroll(state, 'scroll.hold-monster');
    const monster = state.entities.e1; if (monster?.kind !== 'monster') throw new Error('missing monster');
    monster.at = { x: 7, y: 5 }; monster.roomId = 0; monster.flags |= IS_RUNNING;
    const session = new GameSession(state); session.submit({ expectedRevision: 0, action: { type: 'read', itemId } }); const after = session.exportState();
    expect((after.entities.e1 as { flags: number }).flags & IS_RUNNING).toBe(0);
    expect((after.entities.e1 as { flags: number }).flags & IS_HELD).not.toBe(0);
    expect(after.identification.find(value => value.definitionId === 'scroll.hold-monster')?.known).toBe(true);
  });

  it('enchants and protects armor, enchants weapons, then removes equipment curses', () => {
    const state = createTwoRoomFixture(203); const armorId = allocateId(state); const weaponId = allocateId(state);
    state.entities[armorId] = { kind: 'item', id: armorId, definitionId: 'armor.chain', category: 'armor', location: { kind: 'pack', owner: 'player' }, quantity: 1, flags: IS_CURSED, group: 0, label: null, armorClass: 5 };
    state.entities[weaponId] = { kind: 'item', id: weaponId, definitionId: 'weapon.mace', category: 'weapon', location: { kind: 'pack', owner: 'player' }, quantity: 1, flags: IS_CURSED, group: 0, label: null, hitBonus: 0, damageBonus: 0 };
    state.player.packOrder.push(armorId, weaponId); state.player.equipment.armor = armorId; state.player.equipment.weapon = weaponId;
    for (const definition of ['scroll.enchant-armor', 'scroll.protect-armor', 'scroll.enchant-weapon', 'scroll.remove-curse']) addScroll(state, definition);
    const session = new GameSession(state);
    for (const id of [...state.player.packOrder].slice(2)) { const revision = session.exportState().timing.revision;
      session.submit({ expectedRevision: revision, action: { type: 'read', itemId: id } });
      if (session.exportState().pendingDecision) session.submit({ expectedRevision: revision + 1, action: { type: 'answerCall', label: null } }); }
    const after = session.exportState(); const armor = after.entities[armorId] as ItemState; const weapon = after.entities[weaponId] as ItemState;
    expect(armor).toMatchObject({ armorClass: 4 }); expect(armor.flags & (IS_CURSED | IS_PROTECTED)).toBe(IS_PROTECTED);
    expect(weapon.flags & IS_CURSED).toBe(0); expect((weapon as Extract<ItemState, { category: 'weapon' }>).hitBonus
      + (weapon as Extract<ItemState, { category: 'weapon' }>).damageBonus).toBe(1);
  });

  it('maps hidden terrain, detects food, and aggravates every monster', () => {
    const state = createTwoRoomFixture(204); const hidden = state.level.tiles.find(tile => tile.terrain === 'wallH')!; hidden.secret = true;
    const foodId = allocateId(state); state.entities[foodId] = { kind: 'item', id: foodId, definitionId: 'food.ration', category: 'food',
      location: { kind: 'floor', levelId: 1, at: { x: 8, y: 5 } }, quantity: 1, flags: 0, group: 0, label: null }; state.level.floorObjectOrder.push(foodId);
    const ids = ['scroll.magic-mapping', 'scroll.food-detection', 'scroll.aggravate-monsters'].map(definition => addScroll(state, definition));
    const session = new GameSession(state); let foodEvents: unknown[] = [];
    for (const id of ids) { const revision = session.exportState().timing.revision; const result = session.submit({ expectedRevision: revision, action: { type: 'read', itemId: id } });
      if (id === ids[1]) foodEvents = result.events; if (session.exportState().pendingDecision) session.submit({ expectedRevision: revision + 1, action: { type: 'answerCall', label: null } }); }
    const after = session.exportState(); expect(after.level.tiles.some(tile => tile.secret)).toBe(false);
    expect(foodEvents).toContainEqual({ type: 'itemsDetected', glyph: ':', positions: [{ x: 8, y: 5 }] });
    expect((after.entities.e1 as { flags: number }).flags & IS_RUNNING).not.toBe(0);
  });
});
