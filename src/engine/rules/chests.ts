import type { RawEventInput } from '../model/action';
import type { WorldState } from '../model/state';
import { canMoveDiagonally } from './movement';
import { isPositionVisible, observe } from '../perception/knowledge';
import { rnd } from '../random';
import type { RuleResult } from '../session';

/** A chest grants gold once; its opened state travels with saves and replays. */
export function openChest(state: WorldState, chestId: string, emit: (event: RawEventInput) => void): RuleResult {
  const chest = state.level.rooms.flatMap(room => room.design.decorations)
    .find(decoration => decoration.id === chestId && decoration.kind === 'crate');
  if (!chest || !observe(state).decorations.some(decoration => decoration.token === chestId)
    || Math.hypot(chest.at.x - state.player.at.x, chest.at.y - state.player.at.y) > 2)
    return { resolved: false, consumedSlot: false, reason: 'chest-out-of-reach' };
  if (chest.opened) {
    emit({ type: 'sourceMessage', text: 'The chest is empty. You already collected its contents.' });
    return { resolved: true, consumedSlot: false, reason: null };
  }
  const gold = 10 + state.level.depth * 5 + rnd(state.rng, 20 + state.level.depth * 10);
  chest.opened = true;
  state.player.gold += gold;
  emit({ type: 'sourceMessage', text: `You open the chest. Contents: ${gold} gold pieces. Added to your gold.` });
  return { resolved: true, consumedSlot: true, reason: null };
}

/** Walking beside a reachable chest collects it as part of that movement turn. */
export function openAdjacentChests(state: WorldState, emit: (event: RawEventInput) => void): void {
  if (state.timing.status !== 'playing') return;
  for (const room of state.level.rooms) for (const chest of room.design.decorations) {
    if (chest.kind !== 'crate' || chest.opened) continue;
    const dx = Math.abs(chest.at.x - state.player.at.x), dy = Math.abs(chest.at.y - state.player.at.y);
    if (dx > 1 || dy > 1 || !isPositionVisible(state, chest.at)
      || !canMoveDiagonally(state, state.player.at, chest.at)) continue;
    openChest(state, chest.id, emit);
  }
}
