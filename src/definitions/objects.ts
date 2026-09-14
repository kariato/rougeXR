import { POTION_DEFINITIONS, RING_DEFINITIONS, SCROLL_DEFINITIONS, STICK_DEFINITIONS } from '../engine/identification';

export interface WeightedDefinition { id: string; weight: number }
const weighted = (definitions: readonly (readonly [string, string])[], weights: readonly number[]): WeightedDefinition[] =>
  definitions.map(([id], index) => ({ id, weight: weights[index]! }));

export const POTIONS = weighted(POTION_DEFINITIONS, [7,8,8,13,3,13,6,6,2,5,5,13,5,6]);
export const SCROLLS = weighted(SCROLL_DEFINITIONS, [7,4,2,3,7,10,10,6,7,10,3,2,5,8,4,7,3,2]);
export const RINGS = weighted(RING_DEFINITIONS, [9,9,5,10,10,1,10,8,8,4,9,5,7,5]);
export const STICKS = weighted(STICK_DEFINITIONS, [12,6,3,3,3,15,10,10,11,9,1,6,6,5]);
export const ARMORS = [
  ['armor.leather',20,8],['armor.ring-mail',15,7],['armor.studded-leather',15,7],['armor.scale-mail',13,6],
  ['armor.chain',12,5],['armor.splint-mail',10,4],['armor.banded-mail',10,4],['armor.plate-mail',5,3],
] as const;
export const WEAPONS = [
  ['weapon.mace',11],['weapon.long-sword',11],['weapon.short-bow',12],['weapon.arrow',12],['weapon.dagger',8],
  ['weapon.two-handed-sword',10],['weapon.dart',12],['weapon.shuriken',12],['weapon.spear',12],
] as const;
export const WEAPON_DAMAGE: ReadonlyMap<string, readonly [number, number]> = new Map([
  ['weapon.mace',[2,4]],['weapon.long-sword',[3,4]],['weapon.short-bow',[1,1]],['weapon.arrow',[1,1]],['weapon.dagger',[1,6]],
  ['weapon.two-handed-sword',[4,4]],['weapon.dart',[1,1]],['weapon.shuriken',[1,2]],['weapon.spear',[2,3]],
] as const);
