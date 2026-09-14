import { ARMORS, POTIONS, RINGS, SCROLLS, STICKS, WEAPONS, type WeightedDefinition } from '../../definitions/objects';
import type { EntityId, ItemLocation, ItemState, RandomState } from '../model/state';
import { rnd } from '../random';
import { IS_CURSED } from '../rules/flags';

export interface ObjectGenerationContext { noFood: number; nextGroup: number }

/** things.c new_thing(): create one complete source-weighted object. */
export function generateObject(rng: RandomState, context: ObjectGenerationContext, id: EntityId, location: ItemLocation): ItemState {
  const category = context.noFood > 3 ? 2 : pickIndex(rng, [26, 36, 16, 7, 7, 4, 4]);
  const base = { kind: 'item' as const, id, location, quantity: 1, flags: 0, group: 0, label: null };
  if (category === 0) return { ...base, definitionId: pick(rng, POTIONS).id, category: 'potion' };
  if (category === 1) return { ...base, definitionId: pick(rng, SCROLLS).id, category: 'scroll' };
  if (category === 2) { context.noFood = 0; return { ...base, definitionId: rnd(rng, 10) === 0 ? 'food.slime-mold' : 'food.ration', category: 'food' }; }
  if (category === 3) {
    const [definitionId] = pickTuple(rng, WEAPONS); let quantity = 1; let group = 0;
    if (definitionId === 'weapon.dagger') { quantity = rnd(rng, 4) + 2; group = context.nextGroup++; }
    else if (['weapon.arrow','weapon.dart','weapon.shuriken'].includes(definitionId)) { quantity = rnd(rng, 8) + 8; group = context.nextGroup++; }
    const item: Extract<ItemState,{category:'weapon'}> = { ...base, definitionId, category: 'weapon', quantity, group, hitBonus: 0, damageBonus: 0 };
    const quality = rnd(rng, 100); if (quality < 10) { item.flags |= IS_CURSED; item.hitBonus -= rnd(rng, 3) + 1; }
    else if (quality < 15) item.hitBonus += rnd(rng, 3) + 1; return item;
  }
  if (category === 4) { const [definitionId,,armorClass] = pickTuple(rng, ARMORS);
    const item: Extract<ItemState,{category:'armor'}> = { ...base, definitionId, category: 'armor', armorClass };
    const quality = rnd(rng, 100); if (quality < 20) { item.flags |= IS_CURSED; item.armorClass += rnd(rng, 3) + 1; }
    else if (quality < 28) item.armorClass -= rnd(rng, 3) + 1; return item;
  }
  if (category === 5) { const definitionId = pick(rng, RINGS).id; let magnitude = 0; let flags = 0;
    if (['ring.add-strength','ring.protection','ring.dexterity','ring.increase-damage'].includes(definitionId)) { magnitude = rnd(rng, 3); if (magnitude === 0) { magnitude = -1; flags |= IS_CURSED; } }
    if (definitionId === 'ring.aggravate-monster' || definitionId === 'ring.teleportation') flags |= IS_CURSED;
    return { ...base, definitionId, category: 'ring', magnitude, flags };
  }
  const definitionId = pick(rng, STICKS).id; return { ...base, definitionId, category: 'stick', charges: definitionId === 'stick.light' ? rnd(rng, 10) + 10 : rnd(rng, 5) + 3 };
}

function pick(rng: RandomState, entries: readonly WeightedDefinition[]): WeightedDefinition { return entries[pickIndex(rng, entries.map(entry => entry.weight))]!; }
function pickTuple<T extends readonly [string, number, ...number[]]>(rng: RandomState, entries: readonly T[]): T { return entries[pickIndex(rng, entries.map(entry => entry[1]))]!; }
function pickIndex(rng: RandomState, weights: readonly number[]): number { const value = rnd(rng, 100); let total = 0;
  for (let index = 0; index < weights.length; index++) { total += weights[index]!; if (value < total) return index; } return 0;
}
