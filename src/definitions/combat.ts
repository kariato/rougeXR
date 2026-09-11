import type { CombatStats, DiceGroup } from '../engine/model/state';

/** fight.c str_plus and add_dam, indexed by strength 0..31. */
export const STRENGTH_HIT_BONUS = Object.freeze([-7,-6,-5,-4,-3,-2,-1,0,0,0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,2,2,2,2,2,2,3]);
export const STRENGTH_DAMAGE_BONUS = Object.freeze([-7,-6,-5,-4,-3,-2,-1,0,0,0,0,0,0,0,0,0,1,1,2,3,3,4,5,5,5,5,5,5,5,5,5,6]);

export function parseDamage(source: string): DiceGroup[] {
  if (!/^\d+x\d+(?:\/\d+x\d+)*$/.test(source)) throw new TypeError(`Malformed damage definition: ${source}`);
  return source.split('/').map(group => {
    const [count, sides] = group.split('x').map(Number);
    if (!Number.isSafeInteger(count) || !Number.isSafeInteger(sides)) throw new TypeError(`Malformed damage definition: ${source}`);
    return { count: count!, sides: sides! };
  });
}

export const KESTREL = Object.freeze({
  id: 'monster.kestrel', name: 'kestrel', glyph: 'K', carryChance: 0,
  flags: 0o4000 | 0o40000,
  stats: { strength: 10, experience: 1, level: 1, armorClass: 7, hp: 1, maxHp: 1, damage: parseDamage('1x4') } satisfies CombatStats,
  source: { file: 'extern.c', symbol: "monsters['K'-'A']" },
});
