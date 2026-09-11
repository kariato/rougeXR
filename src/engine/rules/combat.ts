import { STRENGTH_DAMAGE_BONUS, STRENGTH_HIT_BONUS } from '../../definitions/combat';
import { buildIndexes, transferItem } from '../entities';
import { cellIndex, isPlayable, tileAt } from '../grid';
import type { RawEventInput } from '../model/action';
import type { CombatStats, EntityId, MonsterState, Position, WorldState } from '../model/state';
import { rnd } from '../random';
import { canMoveDiagonally, canStepTerrain } from './movement';
import { IS_FLYING, IS_HELD, IS_RUNNING, IS_SLOWED } from './flags';

export type EmitRaw = (event: RawEventInput) => void;

export function attackMonster(state: WorldState, id: EntityId, emit: EmitRaw): void {
  const monster = state.entities[id];
  if (monster?.kind !== 'monster') throw new Error('Unknown monster');
  state.timing.quiet = 0; monster.flags |= IS_RUNNING; monster.target = { kind: 'player' };
  const weapon = state.player.equipment.weapon ? state.entities[state.player.equipment.weapon] : null;
  const hitBonus = weapon?.kind === 'item' && weapon.category === 'weapon' ? weapon.hitBonus : 0;
  const damageBonus = weapon?.kind === 'item' && weapon.category === 'weapon' ? weapon.damageBonus : 0;
  strike(state, 'player', state.player.stats, id, monster.stats, emit, hitBonus, damageBonus);
  if (monster.stats.hp === 0) destroyMonster(state, monster, emit);
}

export function attackPlayer(state: WorldState, monster: MonsterState, emit: EmitRaw): void {
  state.timing.quiet = 0;
  const armor = state.player.equipment.armor ? state.entities[state.player.equipment.armor] : null;
  const defender = armor?.kind === 'item' && armor.category === 'armor' ? { ...state.player.stats, armorClass: armor.armorClass } : state.player.stats;
  strike(state, monster.id, monster.stats, 'player', defender, emit);
  state.player.stats.hp = defender.hp;
  if (state.player.stats.hp === 0) {
    state.timing.status = 'dead';
    emit({ type: 'actorDefeated', actorId: 'player', byActorId: monster.id });
    emit({ type: 'sourceMessage', text: `The kestrel defeated you.` });
  }
}

function strike(state: WorldState, attackerId: string, attacker: CombatStats, defenderId: string, defender: CombatStats, emit: EmitRaw, weaponHit = 0, weaponDamage = 0): void {
  const strength = attacker.strength;
  if (!Number.isSafeInteger(strength) || strength < 0 || strength >= STRENGTH_HIT_BONUS.length) throw new Error('Strength is outside source table');
  const defenderFlags = defenderId === 'player' ? state.player.flags : (state.entities[defenderId] as MonsterState).flags;
  const hitBonus = weaponHit + STRENGTH_HIT_BONUS[strength]! + ((defenderFlags & IS_RUNNING) === 0 ? 4 : 0);
  for (let groupIndex = 0; groupIndex < attacker.damage.length && defender.hp > 0; groupIndex++) {
    const group = attacker.damage[groupIndex]!;
    const roll = rnd(state.rng, 20);
    const hit = roll + hitBonus >= (20 - attacker.level) - defender.armorClass;
    let damage = 0;
    if (hit) {
      for (let die = 0; die < group.count; die++) damage += rnd(state.rng, group.sides) + 1;
      damage = Math.max(0, damage + weaponDamage + STRENGTH_DAMAGE_BONUS[strength]!);
      const before = defender.hp; defender.hp = Math.max(0, defender.hp - damage);
      emit({ type: 'hpChanged', actorId: defenderId, from: before, to: defender.hp });
    }
    emit({ type: 'attackResolved', attackerId, defenderId, groupIndex, roll, hit, damage });
  }
}

function destroyMonster(state: WorldState, monster: MonsterState, emit: EmitRaw): void {
  const at = { ...monster.at };
  for (const itemId of [...monster.packOrder]) {
    const drop = findDrop(state, at);
    if (!drop) throw new Error('No legal carried-item drop position');
    transferItem(state, itemId, { kind: 'floor', levelId: state.level.id, at: drop });
  }
  state.level.monsterOrder.splice(state.level.monsterOrder.indexOf(monster.id), 1);
  delete state.entities[monster.id];
  state.player.stats.experience += monster.stats.experience;
  emit({ type: 'actorDefeated', actorId: monster.id, byActorId: 'player' });
  emit({ type: 'sourceMessage', text: 'You defeated the kestrel.' });
}

function findDrop(state: WorldState, origin: Position): Position | null {
  const objects = buildIndexes(state).objects;
  for (let x = origin.x - 1; x <= origin.x + 1; x++) for (let y = origin.y - 1; y <= origin.y + 1; y++) {
    const at = { x, y };
    if (isPlayable(state.level, at) && canStepTerrain(tileAt(state.level, at).terrain)
      && !objects.has(cellIndex(state.level, at))) return at;
  }
  return null;
}

export function runMonsters(state: WorldState, emit: EmitRaw): void {
  for (const id of [...state.level.monsterOrder]) {
    const monster = state.entities[id];
    if (state.timing.status !== 'playing' || monster?.kind !== 'monster' || (monster.flags & (IS_RUNNING | IS_HELD)) !== IS_RUNNING) continue;
    if ((monster.flags & IS_SLOWED) === 0 || monster.slowTurn) chaseOnce(state, monster, emit);
    monster.slowTurn = !monster.slowTurn;
    if (state.timing.status === 'playing' && (monster.flags & IS_FLYING) !== 0 && distanceSquared(monster.at, state.player.at) >= 3) chaseOnce(state, monster, emit);
  }
}

function chaseOnce(state: WorldState, monster: MonsterState, emit: EmitRaw): void {
  let best: Position | null = null; let bestDistance = Number.POSITIVE_INFINITY; let equal = 0;
  const indexes = buildIndexes(state);
  for (let x = monster.at.x - 1; x <= monster.at.x + 1; x++) for (let y = monster.at.y - 1; y <= monster.at.y + 1; y++) {
    const at = { x, y };
    if ((x === monster.at.x && y === monster.at.y) || !isPlayable(state.level, at)
      || !canStepTerrain(tileAt(state.level, at).terrain) || !canMoveDiagonally(state, monster.at, at)) continue;
    const occupied = indexes.monsters.get(cellIndex(state.level, at));
    if (occupied && occupied !== monster.id) continue;
    const distance = distanceSquared(at, state.player.at);
    if (distance < bestDistance) { best = at; bestDistance = distance; equal = 1; }
    else if (distance === bestDistance && rnd(state.rng, ++equal) === 0) best = at;
  }
  if (!best) return;
  if (best.x === state.player.at.x && best.y === state.player.at.y) { attackPlayer(state, monster, emit); return; }
  const from = { ...monster.at }; monster.at = best;
  emit({ type: 'actorMoved', actorId: monster.id, from, to: { ...best } });
}

const distanceSquared = (a: Position, b: Position): number => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
