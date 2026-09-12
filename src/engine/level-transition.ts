import { generateLevelContentFromRandom } from './generation/level';
import { cellIndex } from './grid';
import type { RawEventInput } from './model/action';
import type { EntityState, WorldState } from './model/state';
import { updateKnowledge } from './perception/knowledge';
import { IS_HELD } from './rules/flags';
import { wakeRoomMonsters } from './rules/combat';

export interface LevelTransitionResult { resolved: boolean; consumedSlot: boolean; reason: string | null }

export function descendAtStairs(state: WorldState, emit: (event: RawEventInput) => void): LevelTransitionResult {
  if (state.level.tiles[cellIndex(state.level, state.player.at)]?.feature?.kind !== 'stairs')
    return { resolved: false, consumedSlot: false, reason: 'not-on-stairs' };
  descendLevel(state, emit, 'stairs'); return { resolved: true, consumedSlot: true, reason: null };
}

export function descendLevel(state: WorldState, emit: (event: RawEventInput) => void, cause: 'stairs' | 'trapDoor'): void {
  const fromDepth = state.level.depth;
  const retained: Record<string, EntityState> = {};
  for (const id of state.player.packOrder) { const item = state.entities[id]; if (item?.kind !== 'item') throw new Error('Player pack is inconsistent'); retained[id] = item; }
  const generated = generateLevelContentFromRandom(state.rng, fromDepth + 1, state.nextEntitySerial);
  state.entities = { ...retained, ...generated.entities }; state.level = generated.level; state.nextEntitySerial = generated.nextEntitySerial;
  state.player.at = generated.playerAt; state.player.roomId = generated.playerRoomId; state.player.flags &= ~IS_HELD;
  wakeRoomMonsters(state);
  state.timing.noFood = Object.values(generated.entities).some(entity => entity.kind === 'item' && entity.category === 'food') ? 0 : state.timing.noFood + 1;
  state.knowledge = { levelId: state.level.id, remembered: Array.from({ length: state.level.tiles.length }, () => null) }; updateKnowledge(state);
  emit({ type: 'levelChanged', fromDepth, toDepth: state.level.depth, cause });
  emit({ type: 'sourceMessage', text: cause === 'trapDoor' ? 'You fell into a trap!' : 'You descend the stairs.' });
}
