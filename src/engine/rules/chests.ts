import type { RawEventInput } from '../model/action';
import type { WorldState } from '../model/state';
import { observe } from '../perception/knowledge';
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
