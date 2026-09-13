import type { RawEventInput } from '../model/action';
import type { EntityId, WorldState } from '../model/state';
import { rnd } from '../random';
import { lengthen, scheduleFuse } from '../scheduler';
import { IS_CONFUSED, IS_HALLUCINATING } from './flags';
import type { InventoryResult } from './inventory';

const CONFUSION_DURATION = 20;

/** First potion effect from potions.c quaff()/do_pot(). */
export function drinkItem(state: WorldState, itemId: EntityId, emit: (event: RawEventInput) => void): InventoryResult {
  const item = state.entities[itemId];
  if (item?.kind !== 'item' || item.location.kind !== 'pack' || item.location.owner !== 'player')
    return { resolved: false, consumedSlot: false, reason: 'not-carried' };
  if (item.category !== 'potion') {
    emit({ type: 'sourceMessage', text: 'Yuk! Why would you want to drink that?' });
    return { resolved: false, consumedSlot: false, reason: 'undrinkable' };
  }
  if (item.definitionId !== 'potion.confuse')
    return { resolved: false, consumedSlot: false, reason: `unsupported-potion:${item.definitionId}` };

  const entry = state.identification.find(candidate => candidate.definitionId === item.definitionId);
  if (!entry) throw new Error(`Missing identification entry for ${item.definitionId}`);
  const hallucinating = (state.player.flags & IS_HALLUCINATING) !== 0;
  if (!hallucinating && !entry.known) {
    entry.known = true; entry.called = null;
    emit({ type: 'identityLearned', definitionId: item.definitionId });
  }

  const duration = CONFUSION_DURATION - Math.trunc(CONFUSION_DURATION / 20)
    + rnd(state.rng, Math.trunc(CONFUSION_DURATION / 10));
  if ((state.player.flags & IS_CONFUSED) === 0) {
    state.player.flags |= IS_CONFUSED;
    scheduleFuse(state.timing.scheduler, 'unconfuse', 0, 'after', duration);
  } else lengthen(state.timing.scheduler, 'unconfuse', duration);

  consumeOne(state, itemId);
  emit({ type: 'itemConsumed', itemId, category: 'potion' });
  emit({ type: 'sourceMessage', text: hallucinating ? 'What a tripy feeling!' : "Wait, what's going on here. Huh? What? Who?" });
  return { resolved: true, consumedSlot: true, reason: null };
}

function consumeOne(state: WorldState, itemId: EntityId): void {
  const item = state.entities[itemId];
  if (item?.kind !== 'item') throw new Error('Consumed potion missing');
  item.quantity--;
  if (item.quantity > 0) return;
  const index = state.player.packOrder.indexOf(itemId);
  if (index < 0) throw new Error('Invalid potion membership');
  state.player.packOrder.splice(index, 1); delete state.entities[itemId];
}
