import { buildIndexes, mergeStacks, splitStack, stackCompatible, transferItem } from '../entities';
import { cellIndex } from '../grid';
import type { RawEventInput } from '../model/action';
import type { EntityId, EquipmentSlot, ItemState, WorldState } from '../model/state';
import { IS_CURSED } from './flags';
import { rnd } from '../random';

export const MAX_PACK_SLOTS = 23;
export interface InventoryResult { resolved: boolean; consumedSlot: boolean; reason: string | null }

export function collectItem(state: WorldState, itemId: EntityId, emit: (event: RawEventInput) => void): InventoryResult {
  const item = state.entities[itemId];
  if (item?.kind !== 'item' || item.location.kind !== 'floor' || item.location.levelId !== state.level.id
    || item.location.at.x !== state.player.at.x || item.location.at.y !== state.player.at.y) {
    return { resolved: false, consumedSlot: false, reason: 'no-item-here' };
  }
  if (item.category === 'gold') {
    state.player.gold += item.quantity;
    removeFloorItem(state, item);
    emit({ type: 'itemCollected', itemId, category: 'gold', quantity: item.quantity });
    emit({ type: 'sourceMessage', text: `${item.quantity} gold pieces.` });
    return { resolved: true, consumedSlot: false, reason: null };
  }
  const existing = state.player.packOrder.find(id => state.entities[id]?.kind === 'item'
    && stackCompatible(state.entities[id] as ItemState, item));
  const addedSlots = existing && item.group !== 0 ? 0 : item.group === 0 ? item.quantity : 1;
  if (packSlots(state) + addedSlots > MAX_PACK_SLOTS) {
    emit({ type: 'sourceMessage', text: "There's no room in your pack." });
    return { resolved: false, consumedSlot: false, reason: 'pack-full' };
  }
  transferItem(state, itemId, { kind: 'pack', owner: 'player' });
  const retainedId = existing && mergeStacks(state, existing, itemId) ? existing : itemId;
  emit({ type: 'itemCollected', itemId: retainedId, category: item.category, quantity: item.quantity });
  emit({ type: 'sourceMessage', text: 'You now have an item in your pack.' });
  return { resolved: true, consumedSlot: false, reason: null };
}

export function collectAtPlayer(state: WorldState, emit: (event: RawEventInput) => void): InventoryResult {
  const id = buildIndexes(state).objects.get(cellIndex(state.level, state.player.at));
  return id ? collectItem(state, id, emit) : { resolved: false, consumedSlot: false, reason: 'no-item-here' };
}

export function packSlots(state: WorldState): number {
  return state.player.packOrder.reduce((total, id) => {
    const item = state.entities[id];
    if (item?.kind !== 'item') throw new Error('Invalid player pack');
    return total + (item.group === 0 ? item.quantity : 1);
  }, 0);
}

export function dropItem(state: WorldState, itemId: EntityId, emit: (event: RawEventInput) => void): InventoryResult {
  const item = state.entities[itemId];
  if (item?.kind !== 'item' || item.location.kind !== 'pack' || item.location.owner !== 'player')
    return { resolved: false, consumedSlot: false, reason: 'not-carried' };
  if (Object.values(state.player.equipment).includes(itemId)) {
    emit({ type: 'sourceMessage', text: 'You must remove that equipment first.' });
    return { resolved: false, consumedSlot: false, reason: 'equipped' };
  }
  if (buildIndexes(state).objects.has(cellIndex(state.level, state.player.at))) {
    emit({ type: 'sourceMessage', text: 'There is already something there.' });
    return { resolved: false, consumedSlot: false, reason: 'floor-occupied' };
  }
  const droppedId = item.quantity > 1 ? splitStack(state, itemId) : itemId;
  transferItem(state, droppedId, { kind: 'floor', levelId: state.level.id, at: state.player.at });
  emit({ type: 'itemDropped', itemId: droppedId, category: item.category, quantity: 1 });
  emit({ type: 'sourceMessage', text: 'You dropped an item.' });
  return { resolved: true, consumedSlot: true, reason: null };
}

export function equipItem(state: WorldState, itemId: EntityId, slot: EquipmentSlot, emit: (event: RawEventInput) => void): InventoryResult {
  const item = state.entities[itemId];
  if (item?.kind !== 'item' || item.location.kind !== 'pack' || item.location.owner !== 'player')
    return { resolved: false, consumedSlot: false, reason: 'not-carried' };
  const expected = slot.endsWith('Ring') ? 'ring' : slot;
  if (item.category !== expected) return { resolved: false, consumedSlot: false, reason: 'wrong-slot' };
  const currentId = state.player.equipment[slot];
  if (currentId === itemId) return { resolved: false, consumedSlot: false, reason: 'already-equipped' };
  if (currentId) {
    const current = state.entities[currentId];
    if (current?.kind === 'item' && (current.flags & IS_CURSED) !== 0) {
      emit({ type: 'sourceMessage', text: 'You cannot remove the cursed item.' });
      return { resolved: false, consumedSlot: false, reason: 'cursed' };
    }
    if (slot === 'armor') return { resolved: false, consumedSlot: false, reason: 'armor-already-worn' };
  }
  state.player.equipment[slot] = itemId;
  emit({ type: 'equipmentChanged', slot, itemId });
  emit({ type: 'sourceMessage', text: slot === 'armor' ? 'You are now wearing armor.' : 'You are now wielding a weapon.' });
  return { resolved: true, consumedSlot: true, reason: null };
}

export function unequipItem(state: WorldState, slot: EquipmentSlot, emit: (event: RawEventInput) => void): InventoryResult {
  const id = state.player.equipment[slot];
  if (!id) return { resolved: false, consumedSlot: false, reason: 'slot-empty' };
  const item = state.entities[id]; if (item?.kind !== 'item') throw new Error('Equipped item missing');
  if ((item.flags & IS_CURSED) !== 0) {
    emit({ type: 'sourceMessage', text: 'You cannot remove the cursed item.' });
    return { resolved: false, consumedSlot: false, reason: 'cursed' };
  }
  state.player.equipment[slot] = null; emit({ type: 'equipmentChanged', slot, itemId: null });
  return { resolved: true, consumedSlot: true, reason: null };
}

export function eatItem(state: WorldState, itemId: EntityId, emit: (event: RawEventInput) => void): InventoryResult {
  const item = state.entities[itemId];
  if (item?.kind !== 'item' || item.location.kind !== 'pack' || item.location.owner !== 'player')
    return { resolved: false, consumedSlot: false, reason: 'not-carried' };
  if (item.category !== 'food') {
    emit({ type: 'sourceMessage', text: "That's inedible!" }); return { resolved: false, consumedSlot: false, reason: 'inedible' };
  }
  if (state.timing.foodLeft < 0) state.timing.foodLeft = 0;
  state.timing.foodLeft = Math.min(2000, state.timing.foodLeft + 1100 + rnd(state.rng, 400));
  state.timing.hungerStage = 0;
  if (rnd(state.rng, 100) > 70) { state.player.stats.experience++; emit({ type: 'sourceMessage', text: 'Yuk, this food tastes awful.' }); }
  else emit({ type: 'sourceMessage', text: 'Yum, that tasted good.' });
  item.quantity--;
  if (item.quantity === 0) {
    const index = state.player.packOrder.indexOf(itemId); if (index < 0) throw new Error('Invalid food membership');
    state.player.packOrder.splice(index, 1); delete state.entities[itemId];
  }
  emit({ type: 'itemConsumed', itemId, category: 'food' });
  return { resolved: true, consumedSlot: true, reason: null };
}

function removeFloorItem(state: WorldState, item: ItemState): void {
  const index = state.level.floorObjectOrder.indexOf(item.id);
  if (index < 0) throw new Error('Floor item order is inconsistent');
  state.level.floorObjectOrder.splice(index, 1);
  delete state.entities[item.id];
}
