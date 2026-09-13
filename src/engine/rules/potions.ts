import type { RawEventInput } from '../model/action';
import type { EntityId, WorldState } from '../model/state';
import { rnd, roll } from '../random';
import { extinguish, killDaemon, lengthen, scheduleFuse, startDaemon } from '../scheduler';
import { CAN_DETECT_MONSTERS, CAN_SEE_INVISIBLE, IS_BLIND, IS_CONFUSED, IS_HALLUCINATING, IS_HASTED, IS_INVISIBLE, IS_LEVITATING, IS_PROTECTED, IS_RUNNING } from './flags';
import type { InventoryResult } from './inventory';
import { recoverSight } from './effects';
import { raiseLevel } from './experience';
import { isPositionVisible } from '../perception/knowledge';

const CONFUSION_DURATION = 20;
const SIGHT_DURATION = 850;
const LEVITATION_DURATION = 30;
const MONSTER_DETECTION_DURATION = 20;

/** Supported potion effects from potions.c quaff()/do_pot(). */
export function drinkItem(state: WorldState, itemId: EntityId, emit: (event: RawEventInput) => void): InventoryResult {
  const item = state.entities[itemId];
  if (item?.kind !== 'item' || item.location.kind !== 'pack' || item.location.owner !== 'player')
    return { resolved: false, consumedSlot: false, reason: 'not-carried' };
  if (item.category !== 'potion') {
    emit({ type: 'sourceMessage', text: 'Yuk! Why would you want to drink that?' });
    return { resolved: false, consumedSlot: false, reason: 'undrinkable' };
  }
  if (!['potion.confuse', 'potion.poison', 'potion.strength', 'potion.see-invisible', 'potion.healing', 'potion.extra-healing',
    'potion.haste', 'potion.restore-strength', 'potion.blindness', 'potion.levitation', 'potion.monster-detection', 'potion.raise-level',
    'potion.hallucinate', 'potion.treasure-detection'].includes(item.definitionId))
    return { resolved: false, consumedSlot: false, reason: `unsupported-potion:${item.definitionId}` };

  const entry = state.identification.find(candidate => candidate.definitionId === item.definitionId);
  if (!entry) throw new Error(`Missing identification entry for ${item.definitionId}`);
  let consumesSlot = true;
  if (item.definitionId === 'potion.confuse') applyConfusion(state, entry, emit);
  else if (item.definitionId === 'potion.poison') applyPoison(state, entry, emit);
  else if (item.definitionId === 'potion.strength') applyGainStrength(state, entry, emit);
  else if (item.definitionId === 'potion.see-invisible') applySeeInvisible(state, emit);
  else if (item.definitionId === 'potion.healing') applyHealing(state, entry, emit);
  else if (item.definitionId === 'potion.extra-healing') applyExtraHealing(state, entry, emit);
  else if (item.definitionId === 'potion.haste') { applyHaste(state, entry, emit); consumesSlot = false; }
  else if (item.definitionId === 'potion.restore-strength') applyRestoreStrength(state, emit);
  else if (item.definitionId === 'potion.blindness') applyBlindness(state, entry, emit);
  else if (item.definitionId === 'potion.levitation') applyLevitation(state, entry, emit);
  else if (item.definitionId === 'potion.monster-detection') applyMonsterDetection(state, emit);
  else if (item.definitionId === 'potion.raise-level') applyRaiseLevel(state, entry, emit);
  else if (item.definitionId === 'potion.hallucinate') applyHallucination(state, entry, emit);
  else applyMagicDetection(state, entry, emit);

  consumeOne(state, itemId);
  emit({ type: 'itemConsumed', itemId, category: 'potion' });
  if (!entry.known && entry.called === null) state.pendingDecision = { kind: 'callItem', definitionId: entry.definitionId };
  return { resolved: true, consumedSlot: consumesSlot, reason: null };
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

function applySeeInvisible(state: WorldState, emit: (event: RawEventInput) => void): void {
  const duration = spread(state, SIGHT_DURATION);
  if ((state.player.flags & CAN_SEE_INVISIBLE) === 0) {
    state.player.flags |= CAN_SEE_INVISIBLE;
    scheduleFuse(state.timing.scheduler, 'unsee', 0, 'after', duration);
  } else lengthen(state.timing.scheduler, 'unsee', duration);
  emit({ type: 'sourceMessage', text: 'This potion tastes like slime-mold juice.' });
  recoverSight(state, emit);
}

function applyHealing(state: WorldState, entry: WorldState['identification'][number], emit: (event: RawEventInput) => void): void {
  learn(entry, emit); const stats = state.player.stats; const before = stats.hp;
  stats.hp += roll(state.rng, stats.level, 4);
  if (stats.hp > stats.maxHp) { stats.maxHp++; stats.hp = stats.maxHp; }
  if (stats.hp !== before) emit({ type: 'hpChanged', actorId: 'player', from: before, to: stats.hp });
  recoverSight(state, emit);
  emit({ type: 'sourceMessage', text: 'You begin to feel better.' });
}

function applyExtraHealing(state: WorldState, entry: WorldState['identification'][number], emit: (event: RawEventInput) => void): void {
  learn(entry, emit); const stats = state.player.stats; const before = stats.hp;
  stats.hp += roll(state.rng, stats.level, 8);
  if (stats.hp > stats.maxHp) {
    if (stats.hp > stats.maxHp + stats.level + 1) stats.maxHp++;
    stats.maxHp++; stats.hp = stats.maxHp;
  }
  if (stats.hp !== before) emit({ type: 'hpChanged', actorId: 'player', from: before, to: stats.hp });
  recoverSight(state, emit); endHallucination(state);
  emit({ type: 'sourceMessage', text: 'You begin to feel much better.' });
}

function applyHaste(state: WorldState, entry: WorldState['identification'][number], emit: (event: RawEventInput) => void): void {
  learn(entry, emit);
  if (state.timing.hasted) {
    state.timing.noCommand += rnd(state.rng, 8); state.timing.hasted = false;
    state.player.flags &= ~(IS_RUNNING | IS_HASTED); extinguish(state.timing.scheduler, 'nohaste');
    emit({ type: 'sourceMessage', text: 'You faint from exhaustion.' }); return;
  }
  state.timing.hasted = true; state.player.flags |= IS_HASTED;
  scheduleFuse(state.timing.scheduler, 'nohaste', 0, 'after', rnd(state.rng, 4) + 4);
  emit({ type: 'sourceMessage', text: 'You feel yourself moving much faster.' });
}

function applyRestoreStrength(state: WorldState, emit: (event: RawEventInput) => void): void {
  let baseStrength = state.player.stats.strength;
  const modifiers: number[] = [];
  for (const slot of ['leftRing', 'rightRing'] as const) {
    const id = state.player.equipment[slot]; const ring = id ? state.entities[id] : null;
    if (ring?.kind === 'item' && ring.category === 'ring' && ring.definitionId === 'ring.add-strength') {
      baseStrength = clampStrength(baseStrength - ring.magnitude); modifiers.push(ring.magnitude);
    }
  }
  baseStrength = Math.max(baseStrength, state.player.maximumStrength);
  state.player.stats.strength = modifiers.reduce((value, modifier) => clampStrength(value + modifier), baseStrength);
  emit({ type: 'sourceMessage', text: 'Hey, this tastes great. It make you feel warm all over.' });
}

function applyBlindness(state: WorldState, entry: WorldState['identification'][number], emit: (event: RawEventInput) => void): void {
  learn(entry, emit); const duration = spread(state, SIGHT_DURATION);
  if ((state.player.flags & IS_BLIND) === 0) {
    state.player.flags |= IS_BLIND;
    scheduleFuse(state.timing.scheduler, 'sight', 0, 'after', duration);
  } else lengthen(state.timing.scheduler, 'sight', duration);
  emit({ type: 'sourceMessage', text: (state.player.flags & IS_HALLUCINATING) !== 0
    ? 'Oh, bummer! Everything is dark! Help!' : 'A cloak of darkness falls around you.' });
}

function applyLevitation(state: WorldState, entry: WorldState['identification'][number], emit: (event: RawEventInput) => void): void {
  learn(entry, emit); const duration = spread(state, LEVITATION_DURATION);
  if ((state.player.flags & IS_LEVITATING) === 0) {
    state.player.flags |= IS_LEVITATING;
    scheduleFuse(state.timing.scheduler, 'land', 0, 'after', duration);
  } else lengthen(state.timing.scheduler, 'land', duration);
  emit({ type: 'sourceMessage', text: (state.player.flags & IS_HALLUCINATING) !== 0
    ? "Oh, wow! You're floating in the air!" : 'You start to float in the air.' });
}

function applyMonsterDetection(state: WorldState, emit: (event: RawEventInput) => void): void {
  const revealed = state.level.monsterOrder.some(id => { const monster = state.entities[id];
    return monster?.kind === 'monster' && (!isPositionVisible(state, monster.at)
      || ((monster.flags & IS_INVISIBLE) !== 0 && (state.player.flags & CAN_SEE_INVISIBLE) === 0)); });
  state.player.flags |= CAN_DETECT_MONSTERS;
  scheduleFuse(state.timing.scheduler, 'turnSee', 1, 'after', MONSTER_DETECTION_DURATION);
  if (!revealed) emit({ type: 'sourceMessage', text: (state.player.flags & IS_HALLUCINATING) !== 0
    ? 'You have a strange feeling for a moment, then it passes.' : 'You have a normal feeling for a moment, then it passes.' });
}

function applyRaiseLevel(state: WorldState, entry: WorldState['identification'][number], emit: (event: RawEventInput) => void): void {
  learn(entry, emit); emit({ type: 'sourceMessage', text: 'You suddenly feel much more skillful.' }); raiseLevel(state, emit);
}

function applyHallucination(state: WorldState, entry: WorldState['identification'][number], emit: (event: RawEventInput) => void): void {
  learn(entry, emit); const duration = spread(state, SIGHT_DURATION);
  if ((state.player.flags & IS_HALLUCINATING) === 0) {
    state.player.flags |= IS_HALLUCINATING; startDaemon(state.timing.scheduler, 'visuals', 0, 'before');
    scheduleFuse(state.timing.scheduler, 'comeDown', 0, 'after', duration);
  } else lengthen(state.timing.scheduler, 'comeDown', duration);
  emit({ type: 'sourceMessage', text: 'Oh, wow! Everything seems so cosmic!' });
}

function applyMagicDetection(state: WorldState, entry: WorldState['identification'][number], emit: (event: RawEventInput) => void): void {
  const positions = Object.values(state.entities).flatMap(entity => entity.kind === 'item' && entity.location.kind === 'floor'
    && isMagic(entity) ? [{ ...entity.location.at }] : []);
  if (positions.length) { learn(entry, emit); emit({ type: 'magicDetected', positions });
    emit({ type: 'sourceMessage', text: 'You sense the presence of magic on this level.' }); }
  else emit({ type: 'sourceMessage', text: (state.player.flags & IS_HALLUCINATING) !== 0
    ? 'You have a strange feeling for a moment, then it passes.' : 'You have a normal feeling for a moment, then it passes.' });
}

function isMagic(item: Extract<WorldState['entities'][string], { kind: 'item' }>): boolean {
  if (['potion', 'scroll', 'stick', 'ring', 'amulet'].includes(item.category)) return true;
  if (item.category === 'weapon') return item.hitBonus !== 0 || item.damageBonus !== 0;
  if (item.category !== 'armor') return false;
  const base = ({ 'armor.leather': 8, 'armor.ring-mail': 7, 'armor.studded-leather': 7, 'armor.scale-mail': 6,
    'armor.chain': 5, 'armor.splint-mail': 4, 'armor.banded-mail': 4, 'armor.plate-mail': 3 } as Record<string, number>)[item.definitionId];
  return (item.flags & IS_PROTECTED) !== 0 || (base !== undefined && item.armorClass !== base);
}

function endHallucination(state: WorldState): void {
  if ((state.player.flags & IS_HALLUCINATING) === 0) return;
  state.player.flags &= ~IS_HALLUCINATING; killDaemon(state.timing.scheduler, 'visuals');
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
