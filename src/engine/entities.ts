import { cellIndex, supportsOccupant } from './grid';
import type { EntityId, ItemLocation, WorldState } from './model/state';

export interface WorldIndexes { monsters: Map<number, EntityId>; objects: Map<number, EntityId> }
export function buildIndexes(state: WorldState): WorldIndexes {
  const result: WorldIndexes = { monsters: new Map(), objects: new Map() };
  for (const [id, entity] of Object.entries(state.entities)) {
    if (id !== entity.id) throw new Error('Registry key/ID mismatch');
    if (entity.kind === 'item' && entity.location.kind === 'pack') continue;
    const at = entity.kind === 'monster' ? entity.at : entity.location.kind === 'floor' ? entity.location.at : null;
    if (!at || !supportsOccupant(state.level, at)) throw new Error(`Invalid occupancy: ${id}`);
    if (entity.kind === 'item' && entity.location.kind === 'floor' && entity.location.levelId !== state.level.id) throw new Error('Wrong floor level');
    const index = cellIndex(state.level, at);
    const target = entity.kind === 'monster' ? result.monsters : result.objects;
    if (target.has(index)) throw new Error(`Duplicate occupancy: ${id}`);
    target.set(index, id);
  }
  return result;
}
export function allocateId(state: WorldState): EntityId {
  const serial = state.nextEntitySerial;
  if (!Number.isSafeInteger(serial) || serial < 1 || serial === Number.MAX_SAFE_INTEGER) throw new Error('Invalid entity serial');
  const id = `e${serial}`;
  if (Object.hasOwn(state.entities, id)) throw new Error('Entity ID already allocated');
  state.nextEntitySerial++;
  return id;
}
function container(state: WorldState, location: ItemLocation): EntityId[] {
  if (location.kind === 'floor') {
    if (location.levelId !== state.level.id) throw new Error('Wrong floor level');
    return state.level.floorObjectOrder;
  }
  if (location.owner === 'player') return state.player.packOrder;
  const owner = state.entities[location.owner];
  if (owner?.kind !== 'monster') throw new Error('Pack owner is not a monster');
  return owner.packOrder;
}
/** Validates all affected containers before mutation. No capacity, curses, or stack rules yet. */
export function transferItem(state: WorldState, id: EntityId, destination: ItemLocation): void {
  const item = state.entities[id];
  if (item?.kind !== 'item') throw new Error('Unknown item');
  const sourceOrder = container(state, item.location);
  const destinationOrder = container(state, destination);
  if (sourceOrder.filter(value => value === id).length !== 1) throw new Error('Invalid source membership');
  if (sourceOrder !== destinationOrder && destinationOrder.includes(id)) throw new Error('Duplicate destination membership');
  if (destination.kind === 'floor') {
    if (!supportsOccupant(state.level, destination.at)) throw new Error('Invalid floor destination');
    const occupant = buildIndexes(state).objects.get(cellIndex(state.level, destination.at));
    if (occupant !== undefined && occupant !== id) throw new Error('Floor already contains an object');
  }
  const leavingPlayer = item.location.kind === 'pack' && item.location.owner === 'player'
    && !(destination.kind === 'pack' && destination.owner === 'player');
  if (leavingPlayer && Object.values(state.player.equipment).includes(id)) throw new Error('Remove equipment before transfer');
  const copied: ItemLocation = destination.kind === 'floor'
    ? { kind: 'floor', levelId: destination.levelId, at: { ...destination.at } }
    : { kind: 'pack', owner: destination.owner };
  if (sourceOrder !== destinationOrder) {
    sourceOrder.splice(sourceOrder.indexOf(id), 1);
    destinationOrder.unshift(id);
  }
  item.location = copied;
}
