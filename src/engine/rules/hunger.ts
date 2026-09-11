import type { RawEventInput } from '../model/action';
import type { WorldState } from '../model/state';
import { rnd } from '../random';

export const HUNGER_TIME = 1300;
export const MORE_TIME = 150;
export const STOMACH_SIZE = 2000;
export const STARVE_TIME = 850;

export function runStomach(state: WorldState, emit: (event: RawEventInput) => void): void {
  const timing = state.timing; const oldStage = timing.hungerStage;
  if (timing.foodLeft <= 0) {
    if (timing.foodLeft-- < -STARVE_TIME) {
      state.player.stats.hp = 0; timing.status = 'dead';
      emit({ type: 'actorDefeated', actorId: 'player', byActorId: 'starvation' });
      emit({ type: 'sourceMessage', text: 'You died of starvation.' }); return;
    }
    if (timing.noCommand > 0 || rnd(state.rng, 5) !== 0) return;
    timing.noCommand += rnd(state.rng, 8) + 4; timing.hungerStage = 3;
    emit({ type: 'sourceMessage', text: 'You faint from lack of food.' });
  } else {
    const oldFood = timing.foodLeft; timing.foodLeft--;
    if (timing.foodLeft < MORE_TIME && oldFood >= MORE_TIME) {
      timing.hungerStage = 2; emit({ type: 'sourceMessage', text: 'You are starting to feel weak.' });
    } else if (timing.foodLeft < 2 * MORE_TIME && oldFood >= 2 * MORE_TIME) {
      timing.hungerStage = 1; emit({ type: 'sourceMessage', text: 'You are starting to get hungry.' });
    }
  }
  if (timing.hungerStage !== oldStage) state.player.flags &= ~0o20000;
}
