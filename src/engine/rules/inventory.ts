import { buildIndexes, mergeStacks, splitStack, stackCompatible, transferItem } from '../entities';
import { cellIndex } from '../grid';
import type { RawEventInput } from '../model/action';
import type { EntityId, ItemState, WorldState } from '../model/state';

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

function removeFloorItem(state: WorldState, item: ItemState): void {
  const index = state.level.floorObjectOrder.indexOf(item.id);
  if (index < 0) throw new Error('Floor item order is inconsistent');
  state.level.floorObjectOrder.splice(index, 1);
  delete state.entities[item.id];
}
