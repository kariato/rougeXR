import { allocateId, buildIndexes } from '../entities';
import { cellIndex } from '../grid';
import type { RawEventInput } from '../model/action';
import type { Position, TrapKind, WorldState } from '../model/state';
import { rnd, roll } from '../random';
import { IS_LEVITATING, IS_PROTECTED } from './flags';

export const ACTIVE_TRAPS = new Set<TrapKind>(['bear', 'sleep', 'arrow', 'dart', 'rust', 'mystery']);
export const DEFERRED_TRAPS = new Set<TrapKind>(['trapDoor', 'teleport']);

export function triggerTrap(state: WorldState, at: Position, emit: (event: RawEventInput) => void): void {
  const feature = state.level.tiles[cellIndex(state.level, at)]?.feature;
  if (feature?.kind !== 'trap' || feature.revealed || (state.player.flags & IS_LEVITATING) !== 0) return;
  if (!ACTIVE_TRAPS.has(feature.trap)) throw new Error(`Trap requires a later phase: ${feature.trap}`);
  feature.revealed = true; emit({ type: 'featureRevealed', at: { ...at }, feature: feature.trap });
  switch (feature.trap) {
    case 'bear': state.timing.noMove += spread(state, 3); message(emit, 'You are caught in a bear trap.'); break;
    case 'sleep': state.timing.noCommand += spread(state, 5); state.player.flags &= ~0o20000;
      message(emit, 'A strange white mist envelops you and you fall asleep.'); break;
    case 'arrow': arrowTrap(state, at, emit); break;
    case 'dart': dartTrap(state, emit); break;
    case 'rust': rustTrap(state, emit); break;
    case 'mystery': mysteryTrap(state, emit); break;
  }
}

function arrowTrap(state: WorldState, at: Position, emit: (event: RawEventInput) => void): void {
  if (swing(state, state.player.stats.level - 1, state.player.stats.armorClass, 1)) {
    hurt(state, roll(state.rng, 1, 6), 'arrow', emit); if (state.timing.status === 'playing') message(emit, 'Oh no! An arrow shot you.');
  } else {
    if (!buildIndexes(state).objects.has(cellIndex(state.level, at))) {
      const id = allocateId(state); state.entities[id] = { kind: 'item', id, definitionId: 'weapon.arrow', category: 'weapon',
        location: { kind: 'floor', levelId: state.level.id, at: { ...at } }, quantity: 1, flags: 0, group: 0, label: null,
        hitBonus: 0, damageBonus: 0 }; state.level.floorObjectOrder.unshift(id);
    }
    message(emit, 'An arrow shoots past you.');
  }
}

function dartTrap(state: WorldState, emit: (event: RawEventInput) => void): void {
  if (!swing(state, state.player.stats.level + 1, state.player.stats.armorClass, 1)) { message(emit, 'A small dart whizzes by your ear.'); return; }
  hurt(state, roll(state.rng, 1, 4), 'poisoned dart', emit); if (state.timing.status !== 'playing') return;
  const saves = roll(state.rng, 1, 20) >= 14 - Math.trunc(state.player.stats.level / 2);
  const sustained = wornRing(state, 'ring.sustain-strength');
  if (!sustained && !saves) state.player.stats.strength = Math.max(0, state.player.stats.strength - 1);
  message(emit, 'A small dart just hit you in the shoulder.');
}

function rustTrap(state: WorldState, emit: (event: RawEventInput) => void): void {
  message(emit, 'A gush of water hits you on the head.');
  const id = state.player.equipment.armor; const armor = id ? state.entities[id] : null;
  if (armor?.kind !== 'item' || armor.category !== 'armor' || armor.definitionId === 'armor.leather' || armor.armorClass >= 9) return;
  if ((armor.flags & IS_PROTECTED) !== 0 || wornRing(state, 'ring.maintain-armor')) { message(emit, 'The rust vanishes instantly.'); return; }
  armor.armorClass++; message(emit, 'Your armor appears weaker.');
}

function mysteryTrap(state: WorldState, emit: (event: RawEventInput) => void): void {
  const outcome = rnd(state.rng, 11); if ([1, 4, 6, 10].includes(outcome)) rnd(state.rng, 8);
  const messages = ['You are suddenly in a parallel dimension.', 'The light suddenly changes color.', 'You feel a sting in your neck.',
    'Multi-colored lines swirl around you.', 'A colored light flashes in your eyes.', 'A spike shoots past your ear!',
    'Sparks dance across your armor.', 'You suddenly feel very thirsty.', 'You feel time speed up.', 'Time seems to slow down.', 'Your pack changes color!'];
  message(emit, messages[outcome]!);
}

function hurt(state: WorldState, damage: number, cause: string, emit: (event: RawEventInput) => void): void {
  const before = state.player.stats.hp; state.player.stats.hp = Math.max(0, before - damage);
  emit({ type: 'hpChanged', actorId: 'player', from: before, to: state.player.stats.hp });
  if (state.player.stats.hp === 0) { state.timing.status = 'dead'; emit({ type: 'actorDefeated', actorId: 'player', byActorId: cause }); message(emit, `A ${cause} killed you.`); }
}
function swing(state: WorldState, level: number, armor: number, bonus: number): boolean { return rnd(state.rng, 20) + bonus >= (20 - level) - armor; }
function spread(state: WorldState, value: number): number { return value - Math.trunc(value / 20) + rnd(state.rng, Math.trunc(value / 10)); }
function wornRing(state: WorldState, definitionId: string): boolean { return ['leftRing', 'rightRing'].some(slot => {
  const id = state.player.equipment[slot as 'leftRing' | 'rightRing']; return id !== null && state.entities[id]?.definitionId === definitionId;
}); }
function message(emit: (event: RawEventInput) => void, text: string): void { emit({ type: 'sourceMessage', text }); }
