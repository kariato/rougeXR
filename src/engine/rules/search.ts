import { isPlayable, tileAt } from '../grid';
import type { RawEventInput } from '../model/action';
import type { WorldState } from '../model/state';
import { rnd } from '../random';
import { IS_BLIND, IS_HALLUCINATING } from './flags';
import type { RuleResult } from '../session';

/** Port of command.c search loop and probabilities for supported semantic tiles. */
export function resolveSearch(state: WorldState, emit: (event: RawEventInput) => void): RuleResult {
  const probabilityPenalty = ((state.player.flags & IS_HALLUCINATING) !== 0 ? 3 : 0)
    + ((state.player.flags & IS_BLIND) !== 0 ? 2 : 0);
  const { x: heroX, y: heroY } = state.player.at;
  for (let y = heroY - 1; y <= heroY + 1; y++) for (let x = heroX - 1; x <= heroX + 1; x++) {
    if ((x === heroX && y === heroY) || !isPlayable(state.level, { x, y })) continue;
    const tile = tileAt(state.level, { x, y });
    if (tile.feature?.kind === 'trap' && !tile.feature.revealed) {
      if (rnd(state.rng, 2 + probabilityPenalty) === 0) {
        tile.feature.revealed = true;
        emit({ type: 'featureRevealed', at: { x, y }, feature: `${tile.feature.trap} trap` });
      }
    } else if (tile.secret && (tile.terrain === 'wallH' || tile.terrain === 'wallV')) {
      if (rnd(state.rng, 5 + probabilityPenalty) === 0) {
        tile.secret = false; tile.terrain = 'door';
        emit({ type: 'featureRevealed', at: { x, y }, feature: 'a secret door' });
      }
    } else if (tile.secret && tile.terrain === 'void') {
      if (rnd(state.rng, 3 + probabilityPenalty) === 0) {
        tile.secret = false; tile.terrain = 'passage';
        emit({ type: 'featureRevealed', at: { x, y }, feature: 'a secret passage' });
      }
    }
  }
  return { resolved: true, consumedSlot: true, reason: null };
}
