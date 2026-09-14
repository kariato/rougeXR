import { MONSTER_DEFINITIONS, STRENGTH_DAMAGE_BONUS, STRENGTH_HIT_BONUS } from '../../definitions/combat';
import { allocateId, buildIndexes, transferItem } from '../entities';
import { cellIndex, isPlayable, tileAt } from '../grid';
import type { RawEventInput } from '../model/action';
import type { CombatStats, EntityId, ItemState, MonsterState, Position, WorldState } from '../model/state';
import { rnd, roll } from '../random';
import { canMoveDiagonally, canStepTerrain } from './movement';
import { CAN_CONFUSE_MONSTER, IS_BLIND, IS_CANCELLED, IS_CONFUSED, IS_FLYING, IS_FOUND, IS_GREEDY, IS_HALLUCINATING, IS_HASTED, IS_HELD, IS_LEVITATING, IS_MEAN, IS_PROTECTED, IS_RUNNING, IS_SLOWED } from './flags';
import { checkLevel, EXPERIENCE_LEVELS } from './experience';
import { ringCombatBonus } from './rings';
import { lengthen, scheduleFuse } from '../scheduler';

export type EmitRaw = (event: RawEventInput) => void;

export function wakeRoomMonsters(state: WorldState, emit: EmitRaw = () => {}): void {
  const roomId = state.player.roomId; if (roomId === null) return;
  if (wearing(state, 'ring.stealth') || (state.player.flags & IS_LEVITATING) !== 0) return;
  for (const id of state.level.monsterOrder) {
    const monster = state.entities[id];
    if (monster?.kind === 'monster' && monster.roomId === roomId && (monster.flags & (IS_MEAN | IS_HELD | IS_RUNNING)) === IS_MEAN
      && rnd(state.rng, 3) !== 0) {
      monster.flags |= IS_RUNNING; monster.target = { kind: 'player' };
      medusaGaze(state, monster, emit);
    }
    if (monster?.kind === 'monster' && monster.roomId === roomId && (monster.flags & (IS_GREEDY | IS_RUNNING)) === IS_GREEDY) {
      monster.flags |= IS_RUNNING; const room = state.level.rooms.find(candidate => candidate.id === roomId);
      monster.target = room?.goldTarget ? { kind: 'position', at: { ...room.goldTarget } } : { kind: 'player' };
    }
  }
}

export function attackMonster(state: WorldState, id: EntityId, emit: EmitRaw): void {
  const monster = state.entities[id];
  if (monster?.kind !== 'monster') throw new Error('Unknown monster');
  state.timing.quiet = 0; monster.flags |= IS_RUNNING; monster.target = { kind: 'player' };
  if (revealXeroc(state, monster, emit)) return;
  const weapon = state.player.equipment.weapon ? state.entities[state.player.equipment.weapon] : null;
  const hitBonus = weapon?.kind === 'item' && weapon.category === 'weapon' ? weapon.hitBonus : 0;
  const damageBonus = weapon?.kind === 'item' && weapon.category === 'weapon' ? weapon.damageBonus : 0;
  const hit = strike(state, 'player', state.player.stats, id, monster.stats, emit, hitBonus+ringCombatBonus(state,'hit'), damageBonus+ringCombatBonus(state,'damage'));
  if (hit && monster.stats.hp > 0 && (state.player.flags & CAN_CONFUSE_MONSTER) !== 0) { monster.flags |= IS_CONFUSED; state.player.flags &= ~CAN_CONFUSE_MONSTER;
    emit({ type: 'sourceMessage', text: 'Your hands stop glowing red.' }); }
  if (monster.stats.hp === 0) destroyMonster(state, monster, emit);
}

export function attackMonsterWithWeapon(state: WorldState, id: EntityId, damage: CombatStats['damage'], hitBonus: number,
  damageBonus: number, emit: EmitRaw): boolean {
  const monster = state.entities[id]; if (monster?.kind !== 'monster') throw new Error('Unknown monster');
  state.timing.quiet = 0; monster.flags |= IS_RUNNING; monster.target = { kind: 'player' }; let hit = false;
  revealXeroc(state, monster, emit);
  const attacker = { ...state.player.stats, damage };
  strike(state, 'player', attacker, id, monster.stats, event => { if (event.type === 'attackResolved' && event.hit) hit = true; emit(event); }, hitBonus, damageBonus);
  if (hit && monster.stats.hp > 0 && (state.player.flags & CAN_CONFUSE_MONSTER) !== 0) { monster.flags |= IS_CONFUSED; state.player.flags &= ~CAN_CONFUSE_MONSTER;
    emit({ type: 'sourceMessage', text: 'Your hands stop glowing red.' }); }
  if (monster.stats.hp === 0) destroyMonster(state, monster, emit); return hit;
}

export function damageMonster(state:WorldState,id:EntityId,amount:number,emit:EmitRaw):void{const monster=state.entities[id];if(monster?.kind!=='monster')return;
  const before=monster.stats.hp;monster.stats.hp=Math.max(0,before-amount);if(monster.stats.hp!==before)emit({type:'hpChanged',actorId:id,from:before,to:monster.stats.hp});
  if(monster.stats.hp===0)destroyMonster(state,monster,emit);else{monster.flags|=IS_RUNNING;monster.target={kind:'player'};}}

export function attackPlayer(state: WorldState, monster: MonsterState, emit: EmitRaw): void {
  state.timing.quiet = 0;
  const glyph = MONSTER_DEFINITIONS.find(definition => definition.id === monster.definitionId)?.glyph;
  if (glyph === 'X' && (state.player.flags & IS_BLIND) === 0) monster.disguise = 'X';
  const armor = state.player.equipment.armor ? state.entities[state.player.equipment.armor] : null;
  const defender = armor?.kind === 'item' && armor.category === 'armor' ? { ...state.player.stats, armorClass: armor.armorClass-ringCombatBonus(state,'armor') }
    : { ...state.player.stats, armorClass: state.player.stats.armorClass-ringCombatBonus(state,'armor') };
  const hit = strike(state, monster.id, monster.stats, 'player', defender, emit);
  state.player.stats.hp = defender.hp;
  if (glyph === 'F' && state.player.stats.hp > 0 && (monster.flags & IS_CANCELLED) === 0) flytrapAttack(state, monster, hit, emit);
  else if (hit && state.player.stats.hp > 0 && (monster.flags & IS_CANCELLED) === 0) applySpecialAttack(state, monster, emit);
  if (state.player.stats.hp === 0) {
    state.timing.status = 'dead';
    emit({ type: 'actorDefeated', actorId: 'player', byActorId: monster.id });
    emit({ type: 'sourceMessage', text: `The ${monsterName(monster)} defeated you.` });
  }
}

function strike(state: WorldState, attackerId: string, attacker: CombatStats, defenderId: string, defender: CombatStats, emit: EmitRaw, weaponHit = 0, weaponDamage = 0): boolean {
  const strength = attacker.strength;
  if (!Number.isSafeInteger(strength) || strength < 0 || strength >= STRENGTH_HIT_BONUS.length) throw new Error('Strength is outside source table');
  const defenderFlags = defenderId === 'player' ? state.player.flags : (state.entities[defenderId] as MonsterState).flags;
  const hitBonus = weaponHit + STRENGTH_HIT_BONUS[strength]! + ((defenderFlags & IS_RUNNING) === 0 ? 4 : 0);
  let didHit = false; for (let groupIndex = 0; groupIndex < attacker.damage.length && defender.hp > 0; groupIndex++) {
    const group = attacker.damage[groupIndex]!;
    const roll = rnd(state.rng, 20);
    const hit = roll + hitBonus >= (20 - attacker.level) - defender.armorClass;
    let damage = 0;
    if (hit) {
      didHit = true;
      for (let die = 0; die < group.count; die++) damage += rnd(state.rng, group.sides) + 1;
      damage = Math.max(0, damage + weaponDamage + STRENGTH_DAMAGE_BONUS[strength]!);
      const before = defender.hp; defender.hp = Math.max(0, defender.hp - damage);
      emit({ type: 'hpChanged', actorId: defenderId, from: before, to: defender.hp });
    }
    emit({ type: 'attackResolved', attackerId, defenderId, groupIndex, roll, hit, damage });
  }
  return didHit;
}

function applySpecialAttack(state: WorldState, monster: MonsterState, emit: EmitRaw): void {
  switch (MONSTER_DEFINITIONS.find(definition => definition.id === monster.definitionId)?.glyph) {
    case 'A': rustArmor(state, emit); break;
    case 'I': state.player.flags &= ~IS_RUNNING; state.timing.noCommand += rnd(state.rng, 2) + 2;
      emit({ type: 'sourceMessage', text: 'You are frozen by the ice monster.' }); break;
    case 'R': if (!saveThrow(state, 0)) {
      if (!wearing(state, 'ring.sustain-strength')) { state.player.stats.strength = Math.max(3, state.player.stats.strength - 1);
        emit({ type: 'sourceMessage', text: 'You feel a bite in your leg and now feel weaker.' }); }
      else emit({ type: 'sourceMessage', text: 'A bite momentarily weakens you.' });
    } break;
    case 'L': stealGold(state, monster, emit); break;
    case 'N': stealMagicItem(state, monster, emit); break;
    case 'W': if (rnd(state.rng, 100) < 15) drainLevel(state, emit); break;
    case 'V': if (rnd(state.rng, 100) < 30) drainMaximumHp(state, monster.id, roll(state.rng, 1, 3), emit); break;
  }
}

function flytrapAttack(state: WorldState, monster: MonsterState, hit: boolean, emit: EmitRaw): void {
  if (hit) { state.player.flags |= IS_HELD; state.sourceState.flytrapHits++; damagePlayer(state, 1, monster.id, emit); }
  else damagePlayer(state, state.sourceState.flytrapHits, monster.id, emit);
}

function stealMagicItem(state: WorldState, monster: MonsterState, emit: EmitRaw): void {
  const equipped = new Set(Object.values(state.player.equipment).filter((id): id is string => id !== null)); let selected: EntityId | null = null; let count = 0;
  for (const id of state.player.packOrder) { const item = state.entities[id]; if (item?.kind !== 'item' || equipped.has(id) || !isMagic(item)) continue;
    if (rnd(state.rng, ++count) === 0) selected = id; }
  if (selected === null) return; const item = state.entities[selected]; state.player.packOrder.splice(state.player.packOrder.indexOf(selected), 1);
  delete state.entities[selected]; removeMonster(state, monster); emit({ type: 'sourceMessage', text: `She stole your ${item?.definitionId.replaceAll('.', ' ')}!` });
}

function isMagic(item: ItemState): boolean {
  if (['potion', 'scroll', 'ring', 'stick', 'amulet'].includes(item.category)) return true;
  if (item.category === 'weapon') return item.hitBonus !== 0 || item.damageBonus !== 0;
  return item.category === 'armor' && item.armorClass !== 0;
}

function medusaGaze(state: WorldState, monster: MonsterState, emit: EmitRaw): void {
  if (monster.definitionId !== 'monster.medusa' || (monster.flags & (IS_FOUND | IS_CANCELLED | IS_RUNNING)) !== IS_RUNNING
    || (state.player.flags & (IS_BLIND | IS_HALLUCINATING)) !== 0) return;
  const room = monster.roomId === null ? null : state.level.rooms.find(candidate => candidate.id === monster.roomId);
  if (room?.dark && distanceSquared(monster.at, state.player.at) >= 3) return; monster.flags |= IS_FOUND;
  if (saveThrow(state, 3)) return; const duration = 19 + rnd(state.rng, 2);
  if ((state.player.flags & IS_CONFUSED) !== 0) lengthen(state.timing.scheduler, 'unconfuse', duration);
  else { state.player.flags |= IS_CONFUSED; scheduleFuse(state.timing.scheduler, 'unconfuse', 0, 'after', duration); }
  emit({ type: 'sourceMessage', text: "The medusa's gaze has confused you." });
}

function rustArmor(state: WorldState, emit: EmitRaw): void {
  const id = state.player.equipment.armor; const armor = id ? state.entities[id] : null;
  if (armor?.kind !== 'item' || armor.category !== 'armor' || armor.definitionId === 'armor.leather' || armor.armorClass >= 9) return;
  if ((armor.flags & IS_PROTECTED) !== 0 || wearing(state, 'ring.maintain-armor')) { emit({ type: 'sourceMessage', text: 'The rust vanishes instantly.' }); return; }
  armor.armorClass++; emit({ type: 'sourceMessage', text: 'Your armor appears weaker.' });
}

function stealGold(state: WorldState, monster: MonsterState, emit: EmitRaw): void {
  const before = state.player.gold; state.player.gold -= rnd(state.rng, 50 + 10 * state.level.depth) + 2;
  if (!saveThrow(state, 3)) for (let count = 0; count < 4; count++) state.player.gold -= rnd(state.rng, 50 + 10 * state.level.depth) + 2;
  state.player.gold = Math.max(0, state.player.gold); removeMonster(state, monster);
  if (state.player.gold !== before) emit({ type: 'sourceMessage', text: 'Your purse feels lighter.' });
}

function drainLevel(state: WorldState, emit: EmitRaw): void {
  const stats = state.player.stats; if (stats.experience === 0) return killPlayer(state, 'energy drain', emit);
  stats.level--; if (stats.level === 0) { stats.experience = 0; stats.level = 1; }
  else stats.experience = (EXPERIENCE_LEVELS[stats.level - 1] ?? 0) + 1;
  drainMaximumHp(state, 'energy drain', roll(state.rng, 1, 10), emit);
}

function drainMaximumHp(state: WorldState, cause: string, amount: number, emit: EmitRaw): void {
  const before = state.player.stats.hp; state.player.stats.hp = Math.max(1, before - amount); state.player.stats.maxHp -= amount;
  emit({ type: 'hpChanged', actorId: 'player', from: before, to: state.player.stats.hp });
  if (state.player.stats.maxHp <= 0) killPlayer(state, cause, emit);
  else emit({ type: 'sourceMessage', text: 'You suddenly feel weaker.' });
}

function damagePlayer(state: WorldState, amount: number, cause: string, emit: EmitRaw): void { if (amount <= 0) return;
  const before = state.player.stats.hp; state.player.stats.hp = Math.max(0, before - amount); emit({ type: 'hpChanged', actorId: 'player', from: before, to: state.player.stats.hp });
  if (state.player.stats.hp === 0) killPlayer(state, cause, emit);
}

function killPlayer(state: WorldState, _cause: string, _emit: EmitRaw): void { state.player.stats.hp = 0; state.timing.status = 'dead'; }
function saveThrow(state: WorldState, which: number): boolean { let adjusted = which;
  if (which === 3) for (const slot of ['leftRing', 'rightRing'] as const) { const id = state.player.equipment[slot]; const ring = id ? state.entities[id] : null;
    if (ring?.kind === 'item' && ring.category === 'ring' && ring.definitionId === 'ring.protection') adjusted -= ring.magnitude; }
  return roll(state.rng, 1, 20) >= 14 + adjusted - Math.trunc(state.player.stats.level / 2); }
function wearing(state: WorldState, definitionId: string): boolean { return (['leftRing', 'rightRing'] as const).some(slot => {
  const id = state.player.equipment[slot]; return id !== null && state.entities[id]?.definitionId === definitionId;
}); }
function removeMonster(state: WorldState, monster: MonsterState): void { const index = state.level.monsterOrder.indexOf(monster.id);
  if (index >= 0) state.level.monsterOrder.splice(index, 1); for (const id of monster.packOrder) delete state.entities[id]; delete state.entities[monster.id]; }

function destroyMonster(state: WorldState, monster: MonsterState, emit: EmitRaw): void {
  const at = { ...monster.at };
  if (monster.definitionId === 'monster.venus-flytrap') { state.player.flags &= ~IS_HELD; state.sourceState.flytrapHits = 0; }
  if (monster.definitionId === 'monster.leprechaun') {
    let quantity = rnd(state.rng, 50 + 10 * state.level.depth) + 2;
    if (saveThrow(state, 3)) for (let count = 0; count < 4; count++) quantity += rnd(state.rng, 50 + 10 * state.level.depth) + 2;
    const id = allocateId(state); state.entities[id] = { kind: 'item', id, definitionId: 'gold.pieces', category: 'gold',
      location: { kind: 'pack', owner: monster.id }, quantity, flags: 0, group: 1, label: null }; monster.packOrder.push(id);
  }
  for (const itemId of [...monster.packOrder]) {
    const drop = findDrop(state, at);
    if (!drop) throw new Error('No legal carried-item drop position');
    transferItem(state, itemId, { kind: 'floor', levelId: state.level.id, at: drop });
  }
  state.level.monsterOrder.splice(state.level.monsterOrder.indexOf(monster.id), 1);
  delete state.entities[monster.id];
  state.player.stats.experience += monster.stats.experience;
  checkLevel(state, emit);
  emit({ type: 'actorDefeated', actorId: monster.id, byActorId: 'player' });
  emit({ type: 'sourceMessage', text: `You defeated the ${monsterName(monster)}.` });
}

function monsterName(monster: MonsterState): string {
  return MONSTER_DEFINITIONS.find(definition => definition.id === monster.definitionId)?.name ?? 'monster';
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
    if (dragonBreath(state, monster, emit)) continue;
    if ((monster.flags & IS_SLOWED) === 0 || monster.slowTurn) chaseOnce(state, monster, emit);
    monster.slowTurn = !monster.slowTurn;
    if (state.timing.status === 'playing' && (monster.flags & IS_HASTED) !== 0) chaseOnce(state, monster, emit);
    if (state.timing.status === 'playing' && (monster.flags & IS_FLYING) !== 0 && distanceSquared(monster.at, state.player.at) >= 3) chaseOnce(state, monster, emit);
  }
}

function dragonBreath(state: WorldState, monster: MonsterState, emit: EmitRaw): boolean {
  if (monster.definitionId !== 'monster.dragon' || (monster.flags & IS_CANCELLED) !== 0) return false;
  const dx = Math.sign(state.player.at.x - monster.at.x); const dy = Math.sign(state.player.at.y - monster.at.y);
  if ((dx === 0 && dy === 0) || (monster.at.x !== state.player.at.x && monster.at.y !== state.player.at.y
    && Math.abs(monster.at.x - state.player.at.x) !== Math.abs(monster.at.y - state.player.at.y)) || distanceSquared(monster.at, state.player.at) > 36
    || rnd(state.rng, 5) !== 0) return false;
  let at = { ...monster.at };
  for (let step = 0; step < 6; step++) { at = { x: at.x + dx, y: at.y + dy };
    if (!isPlayable(state.level, at) || !canStepTerrain(tileAt(state.level, at).terrain)) return false;
    if (at.x === state.player.at.x && at.y === state.player.at.y) { if (!saveThrow(state, 3)) { damagePlayer(state, roll(state.rng, 6, 6), monster.id, emit);
        emit({ type: 'sourceMessage', text: 'You are hit by the flame.' }); } else emit({ type: 'sourceMessage', text: 'The flame whizzes by you.' });
      state.timing.quiet = 0; return true; }
  }
  return false;
}

function chaseOnce(state: WorldState, monster: MonsterState, emit: EmitRaw): void {
  let best: Position | null = null; let bestDistance = Number.POSITIVE_INFINITY; let equal = 0;
  const indexes = buildIndexes(state);
  const randomStep = ((monster.flags & IS_CONFUSED) !== 0 && rnd(state.rng, 5) !== 0)
    || (monster.definitionId === 'monster.phantom' && rnd(state.rng, 5) === 0) || (monster.definitionId === 'monster.bat' && rnd(state.rng, 2) === 0);
  if (randomStep && (monster.flags & IS_CONFUSED) !== 0 && rnd(state.rng, 20) === 0) monster.flags &= ~IS_CONFUSED;
  const targetItem = monster.target?.kind === 'item' ? state.entities[monster.target.id] : null;
  const ultimate = monster.target?.kind === 'position' ? monster.target.at
    : targetItem?.kind === 'item' && targetItem.location.kind === 'floor' ? targetItem.location.at : state.player.at;
  const destination = chaseDestination(state, monster, ultimate);
  for (let x = monster.at.x - 1; x <= monster.at.x + 1; x++) for (let y = monster.at.y - 1; y <= monster.at.y + 1; y++) {
    const at = { x, y };
    if ((x === monster.at.x && y === monster.at.y) || !isPlayable(state.level, at)
      || !canStepTerrain(tileAt(state.level, at).terrain) || !canMoveDiagonally(state, monster.at, at)) continue;
    const occupied = indexes.monsters.get(cellIndex(state.level, at));
    if (occupied && occupied !== monster.id) continue;
    const floorItemId = indexes.objects.get(cellIndex(state.level, at)); const floorItem = floorItemId ? state.entities[floorItemId] : null;
    if (floorItem?.kind === 'item' && floorItem.definitionId === 'scroll.scare-monster') continue;
    const distance = randomStep ? 0 : monster.roomId === null ? routeDistance(state, at, ultimate, indexes.monsters, monster.id) : distanceSquared(at, destination);
    if (distance < bestDistance) { best = at; bestDistance = distance; equal = 1; }
    else if (distance === bestDistance && rnd(state.rng, ++equal) === 0) best = at;
  }
  if (!best) return;
  if (best.x === state.player.at.x && best.y === state.player.at.y) { attackPlayer(state, monster, emit); return; }
  const from = { ...monster.at }; monster.at = best; monster.roomId = tileAt(state.level, best).roomId;
  emit({ type: 'actorMoved', actorId: monster.id, from, to: { ...best } });
  if (monster.target?.kind === 'position' && best.x === monster.target.at.x && best.y === monster.target.at.y) {
    const itemId = buildIndexes(state).objects.get(cellIndex(state.level, best)); if (itemId) transferItem(state, itemId, { kind: 'pack', owner: monster.id });
    monster.target = { kind: 'player' };
  }
}

function chaseDestination(state: WorldState, monster: MonsterState, ultimate: Position): Position {
  const destinationRoom = tileAt(state.level, ultimate).roomId;
  if (monster.roomId === null || monster.roomId === destinationRoom) return ultimate;
  const room = state.level.rooms.find(candidate => candidate.id === monster.roomId);
  return room?.exits.reduce((best, exit) => distanceSquared(exit, ultimate) < distanceSquared(best, ultimate) ? exit : best, room.exits[0]!) ?? ultimate;
}

function routeDistance(state: WorldState, start: Position, goal: Position, monsters: Map<number, EntityId>, self: EntityId): number {
  const queue: Array<{ at: Position; distance: number }> = [{ at: start, distance: 0 }]; const seen = new Set([cellIndex(state.level, start)]);
  for (let cursor = 0; cursor < queue.length; cursor++) { const current = queue[cursor]!; if (current.at.x === goal.x && current.at.y === goal.y) return current.distance;
    for (let x = current.at.x - 1; x <= current.at.x + 1; x++) for (let y = current.at.y - 1; y <= current.at.y + 1; y++) { const at = { x, y };
      if ((x === current.at.x && y === current.at.y) || !isPlayable(state.level, at) || !canStepTerrain(tileAt(state.level, at).terrain)
        || !canMoveDiagonally(state, current.at, at)) continue; const index = cellIndex(state.level, at); const occupant = monsters.get(index);
      if (seen.has(index) || (occupant && occupant !== self)) continue; seen.add(index); queue.push({ at, distance: current.distance + 1 });
    }
  }
  return Number.POSITIVE_INFINITY;
}

function revealXeroc(state: WorldState, monster: MonsterState, emit: EmitRaw): boolean {
  if (monster.definitionId !== 'monster.xeroc' || monster.disguise === 'X' || (state.player.flags & IS_BLIND) !== 0) return false;
  monster.disguise = 'X'; emit({ type: 'sourceMessage', text: "Wait! That's a xeroc!" }); return true;
}

const distanceSquared = (a: Position, b: Position): number => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
