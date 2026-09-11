import { describe, expect, it } from 'vitest';
import { createTwoRoomFixture } from '../../src/debug/fixtures';
import { allocateId, mergeStacks, splitStack, transferItem } from '../../src/engine/entities';
import { collectAtPlayer, collectItem, dropItem, MAX_PACK_SLOTS, packSlots } from '../../src/engine/rules/inventory';
import { GameSession } from '../../src/engine/session';

describe('inventory pickup', () => {
  it('collects gold once, updates the purse, and destroys its entity', () => {
    const state = createTwoRoomFixture(7); const gold = state.entities.e2;
    if (gold?.kind !== 'item') throw new Error('missing gold');
    transferItem(state, gold.id, { kind: 'floor', levelId: state.level.id, at: state.player.at });
    const amount = gold.quantity; const session = new GameSession(state);
    const result = session.submit({ expectedRevision: 0, action: { type: 'pickup' } });
    expect(result).toMatchObject({ status: 'resolved', consumedSlot: true });
    expect(session.exportState().player.gold).toBe(amount);
    expect(session.exportState().entities.e2).toBeUndefined();
    expect(session.exportState().level.floorObjectOrder).not.toContain('e2');
    expect(session.debugEvents()).toContainEqual(expect.objectContaining({ type: 'itemCollected', itemId: 'e2', quantity: amount }));
  });

  it('splits and merges compatible stacks while keeping order and identities valid', () => {
    const state = createTwoRoomFixture(); const item = state.entities.e2;
    if (item?.kind !== 'item') throw new Error('missing item');
    item.category = 'food'; item.definitionId = 'food.ration'; item.quantity = 3;
    transferItem(state, item.id, { kind: 'pack', owner: 'player' });
    const splitId = splitStack(state, item.id);
    expect(state.player.packOrder).toEqual(['e2', splitId]);
    expect(state.entities.e2).toMatchObject({ quantity: 2 }); expect(state.entities[splitId]).toMatchObject({ quantity: 1 });
    expect(mergeStacks(state, 'e2', splitId)).toBe(true);
    expect(state.entities.e2).toMatchObject({ quantity: 3 }); expect(state.entities[splitId]).toBeUndefined();
  });

  it('does not merge weapons with different enchantments', () => {
    const state = createTwoRoomFixture(); const first = state.entities.e2;
    if (first?.kind !== 'item') throw new Error('missing item');
    delete state.entities.e2; state.level.floorObjectOrder.length = 0;
    const makeWeapon = (hitBonus: number) => ({ kind: 'item' as const, id: allocateId(state), definitionId: 'weapon.arrow', category: 'weapon' as const,
      location: { kind: 'pack' as const, owner: 'player' as const }, quantity: 1, flags: 0, group: 4, label: null, hitBonus, damageBonus: 0 });
    const left = makeWeapon(0); const right = makeWeapon(1); state.entities[left.id] = left; state.entities[right.id] = right; state.player.packOrder.push(left.id, right.id);
    expect(mergeStacks(state, left.id, right.id)).toBe(false); expect(state.player.packOrder).toHaveLength(2);
  });

  it('drops one unit from a stack and rejects equipped items before mutation', () => {
    const state = createTwoRoomFixture(); const item = state.entities.e2;
    if (item?.kind !== 'item') throw new Error('missing item');
    item.category = 'food'; item.quantity = 2; transferItem(state, item.id, { kind: 'pack', owner: 'player' });
    const result = dropItem(state, item.id, () => {}); expect(result.resolved).toBe(true);
    expect(state.entities.e2).toMatchObject({ quantity: 1, location: { kind: 'pack', owner: 'player' } });
    expect(state.level.floorObjectOrder).toHaveLength(1);
    const weaponId = state.player.packOrder[0]!; const weapon = state.entities[weaponId];
    if (weapon?.kind !== 'item') throw new Error('missing item');
    weapon.category = 'weapon'; Object.assign(weapon, { hitBonus: 0, damageBonus: 0 }); state.player.equipment.weapon = weaponId;
    const before = structuredClone(state); expect(dropItem(state, weaponId, () => {})).toMatchObject({ reason: 'equipped' }); expect(state).toEqual(before);
  });

  it('rejects stale or remote item identities without mutation', () => {
    const state = createTwoRoomFixture(); const before = structuredClone(state);
    expect(collectItem(state, 'e2', () => {})).toMatchObject({ resolved: false, reason: 'no-item-here' });
    expect(state).toEqual(before);
  });

  it('counts grouped and ungrouped quantities using source pack capacity rules', () => {
    const state = createTwoRoomFixture(); const item = state.entities.e2;
    if (item?.kind !== 'item') throw new Error('missing item');
    item.category = 'food'; item.quantity = MAX_PACK_SLOTS; item.group = 0;
    transferItem(state, item.id, { kind: 'pack', owner: 'player' });
    expect(packSlots(state)).toBe(MAX_PACK_SLOTS);
    item.group = 1; expect(packSlots(state)).toBe(1);
    expect(collectAtPlayer(state, () => {})).toMatchObject({ resolved: false, reason: 'no-item-here' });
  });
});
