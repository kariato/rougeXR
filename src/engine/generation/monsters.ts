import { MONSTER_BY_GLYPH, MONSTER_DEFINITIONS, type MonsterDefinition } from '../../definitions/combat';
import type { EntityId, MonsterState, Position, RandomState } from '../model/state';
import { rnd, roll } from '../random';
import { IS_HASTED } from '../rules/flags';

const LEVEL_MONSTERS = ['K','E','B','S','H','I','R','O','Z','L','C','Q','A','N','Y','F','T','W','P','X','U','M','V','G','J','D'] as const;
const WANDERING = ['K','E','B','S','H',null,'R','O','Z',null,'C','Q','A',null,'Y',null,'T','W','P',null,'U','M','V','G','J',null] as const;
const XEROC_DISGUISES = ['!', '?', ':', ')', ']', '=', '/'] as const;

/** Source randmonster(): select a depth-appropriate species, retrying wandering-table gaps. */
export function randomMonster(rng: RandomState, depth: number, wander: boolean): MonsterDefinition {
  const table = wander ? WANDERING : LEVEL_MONSTERS;
  while (true) {
    let index = depth + (rnd(rng, 10) - 6);
    if (index < 0) index = rnd(rng, 5);
    if (index > 25) index = rnd(rng, 5) + 21;
    const glyph = table[index];
    if (glyph) return MONSTER_BY_GLYPH.get(glyph)!;
  }
}

export function randomMonsterUniform(rng: RandomState): MonsterDefinition {
  return MONSTER_DEFINITIONS[rnd(rng, MONSTER_DEFINITIONS.length)]!;
}

/** Source new_monster() plus the post-Amulet level adjustment in new_level(). */
export function instantiateMonster(rng: RandomState, depth: number, id: EntityId, definition: MonsterDefinition,
  at: Position, roomId: number | null): MonsterState {
  const depthBonus = Math.max(0, depth - 26);
  const level = definition.stats.level + depthBonus;
  const hp = roll(rng, level, 8);
  const experienceBonus = Math.trunc(hp / (level === 1 ? 8 : 6)) * (level > 9 ? 20 : level > 6 ? 4 : 1);
  return {
    kind: 'monster', id, definitionId: definition.id, at: { ...at },
    stats: { ...definition.stats, level, armorClass: definition.stats.armorClass - depthBonus,
      experience: definition.stats.experience + depthBonus * 10 + experienceBonus, hp, maxHp: hp,
      damage: definition.stats.damage.map(group => ({ ...group })) },
    flags: definition.flags | (depth > 29 ? IS_HASTED : 0), slowTurn: true, target: null,
    disguise: definition.glyph === 'X' ? XEROC_DISGUISES[rnd(rng, XEROC_DISGUISES.length)]! : definition.glyph,
    roomId, packOrder: [],
  };
}
