import type { RawEventInput } from '../model/action';
import type { WorldState } from '../model/state';
import { rnd } from '../random';
import { IS_BLIND, IS_CONFUSED } from './flags';

export function runDoctor(state: WorldState, emit: (event: RawEventInput) => void): void {
  const stats = state.player.stats; const before = stats.hp; state.timing.quiet++;
  if (stats.level < 8) {
    if (state.timing.quiet + (stats.level << 1) > 20) stats.hp++;
  } else if (state.timing.quiet >= 3) stats.hp += rnd(state.rng, stats.level - 7) + 1;
  for (const slot of ['leftRing', 'rightRing'] as const) {
    const id = state.player.equipment[slot]; const ring = id ? state.entities[id] : null;
    if (ring?.kind === 'item' && ring.category === 'ring' && ring.definitionId === 'ring.regeneration') stats.hp++;
  }
  if (stats.hp !== before) {
    stats.hp = Math.min(stats.hp, stats.maxHp); state.timing.quiet = 0;
    if (stats.hp !== before) emit({ type: 'hpChanged', actorId: 'player', from: before, to: stats.hp });
  }
}

export function recoverConfusion(state: WorldState, emit: (event: RawEventInput) => void): void {
  state.player.flags &= ~IS_CONFUSED; emit({ type: 'sourceMessage', text: 'You feel less confused now.' });
}

export function recoverSight(state: WorldState, emit: (event: RawEventInput) => void): void {
  state.player.flags &= ~IS_BLIND; emit({ type: 'sourceMessage', text: 'The veil of darkness lifts.' });
}
