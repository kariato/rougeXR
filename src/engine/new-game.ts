import { generateLevelContentFromRandom } from './generation/level';
import type { EntityState, ItemState, WorldState } from './model/state';
import { createRandom, rnd } from './random';
import { createScheduler, scheduleFuse, startDaemon } from './scheduler';
import { updateKnowledge } from './perception/knowledge';
import { validateWorld } from './validate';

const KNOWN = 0o2; const MISSILE = 0o4; const MANY = 0o10;

export function createNewGame(seed: number): WorldState {
  const rng = createRandom(seed); let serial = 1; const nextId = (): string => `e${serial++}`;
  const food = item(nextId(), 'food.ration', 'food');
  const armor = { ...item(nextId(), 'armor.ring-mail', 'armor'), flags: KNOWN, armorClass: 6 } as ItemState;
  const mace = { ...item(nextId(), 'weapon.mace', 'weapon'), flags: KNOWN, hitBonus: 1, damageBonus: 1 } as ItemState;
  const bow = { ...item(nextId(), 'weapon.short-bow', 'weapon'), flags: KNOWN, hitBonus: 1, damageBonus: 0 } as ItemState;
  rnd(rng, 8); // init_weapon(ARROW) group-size draw, overwritten by init_player
  const arrows = { ...item(nextId(), 'weapon.arrow', 'weapon'), flags: KNOWN | MISSILE | MANY, group: 1,
    quantity: rnd(rng, 15) + 25, hitBonus: 0, damageBonus: 0 } as ItemState;
  const generated = generateLevelContentFromRandom(rng, 1, serial); const scheduler = createScheduler();
  startDaemon(scheduler, 'runners', 0, 'after'); startDaemon(scheduler, 'doctor', 0, 'after');
  scheduleFuse(scheduler, 'swander', 0, 'after', spread(rng, 70)); startDaemon(scheduler, 'stomach', 0, 'after');
  const starting = [food, armor, mace, bow, arrows]; const entities: Record<string, EntityState> = { ...generated.entities };
  for (const entry of starting) entities[entry.id] = entry;
  const state: WorldState = {
    seed, rng, nextEntitySerial: generated.nextEntitySerial, entities,
    level: generated.level,
    player: { at: generated.playerAt, roomId: generated.playerRoomId, gold: 0, flags: 0,
      stats: { strength: 16, experience: 0, level: 1, armorClass: 10, hp: 12, maxHp: 12, damage: [{ count: 1, sides: 4 }] },
      packOrder: starting.map(entry => entry.id), equipment: { weapon: mace.id, armor: armor.id, leftRing: null, rightRing: null } },
    timing: { revision: 0, actionSequence: 0, tick: 0, status: 'playing', noCommand: 0, noMove: 0, hasted: false,
      foodLeft: 1300, noFood: 1, quiet: 0, between: 0, hungerStage: 0, scheduler, cycle: { phase: 'begin', slotsRemaining: 0 } },
    knowledge: { levelId: generated.level.id, remembered: Array.from({ length: generated.level.tiles.length }, () => null) },
  };
  updateKnowledge(state); const issues = validateWorld(state); if (issues.length) throw new Error(`Generated world invalid: ${issues[0]!.path}: ${issues[0]!.message}`);
  return state;
}

function item(id: string, definitionId: string, category: 'food' | 'armor' | 'weapon'): ItemState {
  return { kind: 'item', id, definitionId, category, location: { kind: 'pack', owner: 'player' }, quantity: 1, flags: 0, group: 0, label: definitionId } as ItemState;
}
function spread(state: WorldState['rng'], value: number): number { return value - Math.trunc(value / 20) + rnd(state, Math.trunc(value / 10)); }
