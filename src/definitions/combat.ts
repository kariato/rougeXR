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

export interface MonsterDefinition{ id:string;name:string;glyph:string;carryChance:number;flags:number;stats:CombatStats;source:{file:string;symbol:string} }
const rows:[string,string,number,number,number,number,string][]=[
 ['A','aquator',0,0o4000,5,2,'0x0/0x0'],['B','bat',0,0o40000,1,3,'1x2'],['C','centaur',15,0,4,4,'1x2/1x5/1x5'],['D','dragon',100,0o4000,10,-1,'1x8/1x8/3x10'],['E','emu',0,0o4000,1,7,'1x2'],['F','venus-flytrap',0,0o4000,8,3,'0x0'],['G','griffin',20,0o4000|0o40000|0o10000,13,2,'4x3/3x5'],['H','hobgoblin',0,0o4000,1,5,'1x8'],['I','ice-monster',0,0,1,9,'0x0'],['J','jabberwock',70,0,15,6,'2x12/2x4'],['K','kestrel',0,0o4000|0o40000,1,7,'1x4'],['L','leprechaun',0,0,3,8,'1x1'],['M','medusa',40,0o4000,8,2,'3x4/3x4/2x5'],['N','nymph',100,0,3,9,'0x0'],['O','orc',15,0o40,1,6,'1x8'],['P','phantom',0,0o2000,8,3,'4x4'],['Q','quagga',0,0,3,3,'1x5/1x5'],['R','rattlesnake',0,0o4000,2,3,'1x6'],['S','snake',0,0o4000,1,5,'1x3'],['T','troll',50,0o10000|0o4000,6,4,'1x8/1x8/2x6'],['U','black-unicorn',0,0o4000,7,-2,'1x9/1x9/2x9'],['V','vampire',20,0o10000|0o4000,8,1,'1x10'],['W','wraith',0,0,5,4,'1x6'],['X','xeroc',30,0,7,7,'4x4'],['Y','yeti',30,0,4,6,'1x6/1x6'],['Z','zombie',0,0o4000,2,8,'1x8']];
const experience=[20,1,17,5000,2,80,2000,3,5,3000,1,10,200,37,5,120,15,9,2,120,190,350,55,100,50,6];
export const MONSTER_DEFINITIONS:readonly MonsterDefinition[]=Object.freeze(rows.map(([glyph,name,carryChance,flags,level,armorClass,damage],index)=>Object.freeze({id:`monster.${name}`,name:name.replaceAll('-',' '),glyph,carryChance,flags,stats:{strength:10,experience:experience[index]!,level,armorClass,hp:1,maxHp:1,damage:parseDamage(damage)},source:{file:'extern.c',symbol:`monsters['${glyph}'-'A']`}})));
export const MONSTER_BY_GLYPH=new Map(MONSTER_DEFINITIONS.map(value=>[value.glyph,value]));
