import { generateLevelContentFromRandom } from './generation/level';
import { cellIndex } from './grid';
import type { RawEventInput } from './model/action';
import type { EntityState, WorldState } from './model/state';
import { updateKnowledge } from './perception/knowledge';
import { IS_HELD, IS_LEVITATING } from './rules/flags';
import { wakeRoomMonsters } from './rules/combat';

export interface LevelTransitionResult { resolved: boolean; consumedSlot: boolean; reason: string | null }

export function descendAtStairs(state: WorldState, emit: (event: RawEventInput) => void): LevelTransitionResult {
  if ((state.player.flags & IS_LEVITATING) !== 0) { emit({ type: 'sourceMessage', text: "You can't. You're floating off the ground!" });
    return { resolved: false, consumedSlot: false, reason: 'levitating' }; }
  if (state.level.tiles[cellIndex(state.level, state.player.at)]?.feature?.kind !== 'stairs')
    return { resolved: false, consumedSlot: false, reason: 'not-on-stairs' };
  descendLevel(state, emit, 'stairs'); return { resolved: true, consumedSlot: true, reason: null };
}

export function ascendAtStairs(state: WorldState, emit: (event: RawEventInput) => void): LevelTransitionResult {
  if ((state.player.flags & IS_LEVITATING) !== 0) { emit({ type: 'sourceMessage', text: "You can't. You're floating off the ground!" });
    return { resolved: false, consumedSlot: false, reason: 'levitating' }; }
  if (state.level.tiles[cellIndex(state.level, state.player.at)]?.feature?.kind !== 'stairs') return { resolved: false, consumedSlot: false, reason: 'not-on-stairs' };
  if (!hasAmulet(state)) { emit({ type: 'sourceMessage', text: 'Your way is magically blocked.' }); return { resolved: false, consumedSlot: false, reason: 'amulet-required' }; }
  if (state.level.depth === 1) { state.timing.status = 'won'; emit({ type: 'sourceMessage', text: 'You escaped with the Amulet of Yendor!' });
    return { resolved: true, consumedSlot: true, reason: null }; }
  replaceLevel(state, state.level.depth - 1, emit, 'stairs-up'); emit({ type: 'sourceMessage', text: 'You feel a wrenching sensation in your gut.' });
  return { resolved: true, consumedSlot: true, reason: null };
}

export function descendLevel(state: WorldState, emit: (event: RawEventInput) => void, cause: 'stairs' | 'trapDoor'): void {
  const fromDepth = state.level.depth;
  replaceLevel(state, fromDepth + 1, emit, cause); state.sourceState.maximumDepth = Math.max(state.sourceState.maximumDepth, state.level.depth);
  emit({ type: 'sourceMessage', text: cause === 'trapDoor' ? 'You fell into a trap!' : 'You descend the stairs.' });
}
function replaceLevel(state: WorldState, targetDepth: number, emit: (event: RawEventInput) => void, cause: string): void {
  const fromDepth = state.level.depth; const amulet = hasAmulet(state);
  const retained: Record<string, EntityState> = {};
  for (const id of state.player.packOrder) { const item = state.entities[id]; if (item?.kind !== 'item') throw new Error('Player pack is inconsistent'); retained[id] = item; }
  const generated = generateLevelContentFromRandom(state.rng, targetDepth, state.nextEntitySerial, state.timing.noFood, state.sourceState.nextGroup, amulet, state.sourceState.maximumDepth);
  state.entities = { ...retained, ...generated.entities }; state.level = generated.level; state.nextEntitySerial = generated.nextEntitySerial;
  state.player.at = generated.playerAt; state.player.roomId = generated.playerRoomId; state.player.flags &= ~IS_HELD; state.sourceState.nextGroup = generated.nextGroup;
  wakeRoomMonsters(state, emit);
  state.timing.noFood = generated.noFood;
  state.knowledge = { levelId: state.level.id, remembered: Array.from({ length: state.level.tiles.length }, () => null) }; updateKnowledge(state);
  emit({ type: 'levelChanged', fromDepth, toDepth: state.level.depth, cause });
}
function hasAmulet(state: WorldState): boolean { return state.player.packOrder.some(id => state.entities[id]?.definitionId === 'amulet.yendor'); }
