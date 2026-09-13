import type { RawEventInput } from '../model/action';
import type { WorldState } from '../model/state';
import { roll } from '../random';

export const EXPERIENCE_LEVELS = [10, 20, 40, 80, 160, 320, 640, 1300, 2600, 5200,
  13000, 26000, 50000, 100000, 200000, 400000, 800000, 2000000, 4000000, 8000000] as const;

/** misc.c check_level(): derive rank from experience and award one d10 per gained level. */
export function checkLevel(state: WorldState, emit: (event: RawEventInput) => void): void {
  const stats = state.player.stats; const threshold = EXPERIENCE_LEVELS.findIndex(value => value > stats.experience);
  const level = threshold < 0 ? EXPERIENCE_LEVELS.length + 1 : threshold + 1; const oldLevel = stats.level; stats.level = level;
  if (level <= oldLevel) return;
  const before = stats.hp; const add = roll(state.rng, level - oldLevel, 10); stats.maxHp += add; stats.hp += add;
  emit({ type: 'hpChanged', actorId: 'player', from: before, to: stats.hp });
  emit({ type: 'sourceMessage', text: `Welcome to level ${level}.` });
}

/** potions.c raise_level(): move just beyond the current rank's threshold. */
export function raiseLevel(state: WorldState, emit: (event: RawEventInput) => void): void {
  state.player.stats.experience = (EXPERIENCE_LEVELS[state.player.stats.level - 1] ?? 0) + 1; checkLevel(state, emit);
}
