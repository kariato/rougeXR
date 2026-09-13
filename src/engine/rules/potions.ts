import type { RawEventInput } from '../model/action';
import type { EntityId, WorldState } from '../model/state';
import { rnd } from '../random';
import { killDaemon, lengthen, scheduleFuse } from '../scheduler';
import { IS_CONFUSED, IS_HALLUCINATING } from './flags';
import type { InventoryResult } from './inventory';

const CONFUSION_DURATION = 20;

/** Supported potion effects from potions.c quaff()/do_pot(). */
export function drinkItem(state: WorldState, itemId: EntityId, emit: (event: RawEventInput) => void): InventoryResult {
  const item = state.entities[itemId];
  if (item?.kind !== 'item' || item.location.kind !== 'pack' || item.location.owner !== 'player')
    return { resolved: false, consumedSlot: false, reason: 'not-carried' };
  if (item.category !== 'potion') {
    emit({ type: 'sourceMessage', text: 'Yuk! Why would you want to drink that?' });
    return { resolved: false, consumedSlot: false, reason: 'undrinkable' };
  }
  if (!['potion.confuse', 'potion.poison', 'potion.strength'].includes(item.definitionId))
    return { resolved: false, consumedSlot: false, reason: `unsupported-potion:${item.definitionId}` };

  const entry = state.identification.find(candidate => candidate.definitionId === item.definitionId);
  if (!entry) throw new Error(`Missing identification entry for ${item.definitionId}`);
  if (item.definitionId === 'potion.confuse') applyConfusion(state, entry, emit);
  else if (item.definitionId === 'potion.poison') applyPoison(state, entry, emit);
  else applyGainStrength(state, entry, emit);

  consumeOne(state, itemId);
  emit({ type: 'itemConsumed', itemId, category: 'potion' });
  return { resolved: true, consumedSlot: true, reason: null };
}

function applyConfusion(state: WorldState, entry: WorldState['identification'][number], emit: (event: RawEventInput) => void): void {
  const hallucinating = (state.player.flags & IS_HALLUCINATING) !== 0;
  if (!hallucinating) learn(entry, emit);

  const duration = spread(state, CONFUSION_DURATION);
  if ((state.player.flags & IS_CONFUSED) === 0) {
    state.player.flags |= IS_CONFUSED;
    scheduleFuse(state.timing.scheduler, 'unconfuse', 0, 'after', duration);
  } else lengthen(state.timing.scheduler, 'unconfuse', duration);
  emit({ type: 'sourceMessage', text: hallucinating ? 'What a tripy feeling!' : "Wait, what's going on here. Huh? What? Who?" });
}

function applyPoison(state: WorldState, entry: WorldState['identification'][number], emit: (event: RawEventInput) => void): void {
  learn(entry, emit);
  if (wearing(state, 'ring.sustain-strength')) {
    emit({ type: 'sourceMessage', text: 'You feel momentarily sick.' });
    return;
  }
  changeStrength(state, -(rnd(state.rng, 3) + 1));
  state.player.flags &= ~IS_HALLUCINATING;
  killDaemon(state.timing.scheduler, 'visuals');
  emit({ type: 'sourceMessage', text: 'You feel very sick now.' });
}

function applyGainStrength(state: WorldState, entry: WorldState['identification'][number], emit: (event: RawEventInput) => void): void {
  learn(entry, emit); changeStrength(state, 1);
  emit({ type: 'sourceMessage', text: 'You feel stronger, now. What bulging muscles!' });
}

/** misc.c chg_str()/add_str(), including maximum base strength beneath add-strength rings. */
function changeStrength(state: WorldState, amount: number): void {
  state.player.stats.strength = clampStrength(state.player.stats.strength + amount);
  let baseStrength = state.player.stats.strength;
  for (const slot of ['leftRing', 'rightRing'] as const) {
    const id = state.player.equipment[slot]; const ring = id ? state.entities[id] : null;
    if (ring?.kind === 'item' && ring.category === 'ring' && ring.definitionId === 'ring.add-strength')
      baseStrength = clampStrength(baseStrength - ring.magnitude);
  }
  state.player.maximumStrength = Math.max(state.player.maximumStrength, baseStrength);
}

function clampStrength(value: number): number { return Math.max(3, Math.min(31, value)); }

function learn(entry: WorldState['identification'][number], emit: (event: RawEventInput) => void): void {
  if (!entry.known) emit({ type: 'identityLearned', definitionId: entry.definitionId });
  entry.known = true; entry.called = null;
}

function wearing(state: WorldState, definitionId: string): boolean {
  return (['leftRing', 'rightRing'] as const).some(slot => {
    const id = state.player.equipment[slot]; return id !== null && state.entities[id]?.definitionId === definitionId;
  });
}

function spread(state: WorldState, duration: number): number {
  return duration - Math.trunc(duration / 20) + rnd(state.rng, Math.trunc(duration / 10));
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
