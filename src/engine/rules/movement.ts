import { buildIndexes } from '../entities';
import { cellIndex, isPlayable, tileAt } from '../grid';
import type { RawEventInput } from '../model/action';
import type { Direction, EntityId, Position, Terrain, WorldState } from '../model/state';
import { rnd } from '../random';
import { attackMonster } from './combat';
import { IS_CONFUSED } from './flags';
import { ACTIVE_TRAPS, DEFERRED_TRAPS, triggerTrap } from './traps';

export { IS_CONFUSED } from './flags';

const OFFSETS: Record<Direction, Readonly<Position>> = {
  N: { x: 0, y: -1 }, NE: { x: 1, y: -1 }, E: { x: 1, y: 0 }, SE: { x: 1, y: 1 },
  S: { x: 0, y: 1 }, SW: { x: -1, y: 1 }, W: { x: -1, y: 0 }, NW: { x: -1, y: -1 },
};

export interface MoveResult {
  resolved: boolean; consumedSlot: boolean; reason: string | null;
  events: RawEventInput[]; deferredPickup: EntityId | null;
}

export function canStepTerrain(terrain: Terrain): boolean {
  return terrain === 'floor' || terrain === 'door' || terrain === 'passage';
}

/** Port of chase.c diag_ok: both orthogonal cells must pass step_ok. */
export function canMoveDiagonally(state: WorldState, from: Position, to: Position): boolean {
  if (!isPlayable(state.level, to)) return false;
  if (from.x === to.x || from.y === to.y) return true;
  return canStepTerrain(tileAt(state.level, { x: from.x, y: to.y }).terrain)
    && canStepTerrain(tileAt(state.level, { x: to.x, y: from.y }).terrain);
}

export function transitionRegion(state: WorldState, from: Position, to: Position): void {
  const source = tileAt(state.level, from); const destination = tileAt(state.level, to);
  if (destination.terrain === 'passage') state.player.roomId = null;
  else if (destination.terrain === 'floor') state.player.roomId = destination.roomId;
  else if (destination.terrain === 'door' && source.terrain === 'passage') state.player.roomId = destination.roomId;
}

export function resolveMove(state: WorldState, direction: Direction, pickup: boolean): MoveResult {
  const events: RawEventInput[] = [];
  if (state.timing.noMove > 0) {
    state.timing.noMove--;
    events.push({ type: 'sourceMessage', text: 'You are still stuck in the bear trap.' });
    return { resolved: false, consumedSlot: true, reason: 'stuck', events, deferredPickup: null };
  }
  const from = { ...state.player.at };
  let to: Position;
  if ((state.player.flags & IS_CONFUSED) !== 0 && rnd(state.rng, 5) !== 0) {
    to = { x: from.x + rnd(state.rng, 3) - 1, y: from.y + rnd(state.rng, 3) - 1 };
    if ((to.x === from.x && to.y === from.y) || !isLegalDestination(state, from, to)) {
      events.push({ type: 'sourceMessage', text: 'You stumble in confusion.' });
      return { resolved: false, consumedSlot: false, reason: 'confused-no-move', events, deferredPickup: null };
    }
  } else {
    const offset = OFFSETS[direction];
    to = { x: from.x + offset.x, y: from.y + offset.y };
  }
  if (!isLegalDestination(state, from, to)) {
    events.push({ type: 'sourceMessage', text: 'You cannot move there.' });
    return { resolved: false, consumedSlot: false, reason: 'blocked', events, deferredPickup: null };
  }
  const monster = buildIndexes(state).monsters.get(cellIndex(state.level, to));
  if (monster) {
    attackMonster(state, monster, event => events.push(event));
    return { resolved: true, consumedSlot: true, reason: null, events, deferredPickup: null };
  }
  const destinationFeature = tileAt(state.level, to).feature;
  if (destinationFeature?.kind === 'trap' && !destinationFeature.revealed && DEFERRED_TRAPS.has(destinationFeature.trap)) {
    events.push({ type: 'sourceMessage', text: `${destinationFeature.trap} traps require level generation.` });
    return { resolved: false, consumedSlot: false, reason: `unsupported-trap:${destinationFeature.trap}`, events, deferredPickup: null };
  }
  transitionRegion(state, from, to);
  state.player.at = to;
  events.push({ type: 'actorMoved', actorId: 'player', from, to: { ...to } });
  if (destinationFeature?.kind === 'trap' && ACTIVE_TRAPS.has(destinationFeature.trap)) triggerTrap(state, to, event => events.push(event));
  const item = buildIndexes(state).objects.get(cellIndex(state.level, to)) ?? null;
  return { resolved: true, consumedSlot: true, reason: null, events, deferredPickup: pickup ? item : null };
}

function isLegalDestination(state: WorldState, from: Position, to: Position): boolean {
  return isPlayable(state.level, to) && canMoveDiagonally(state, from, to) && canStepTerrain(tileAt(state.level, to).terrain);
}
