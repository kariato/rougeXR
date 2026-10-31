import type { WorldState } from '../model/state';

/** Apply once to each incoming hit, preserving the original normal rules. */
export function incomingDamage(state: WorldState, amount: number): number {
  if (state.settings?.godMode) return 0;
  const multiplier = state.settings?.difficulty === 'easy' ? 0.5 : state.settings?.difficulty === 'hard' ? 1.5 : 1;
  return Math.ceil(Math.max(0, amount) * multiplier);
}
