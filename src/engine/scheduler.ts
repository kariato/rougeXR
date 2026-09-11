import type { ScheduledEntry, SchedulerState } from './model/state';

export const SCHEDULER_CAPACITY = 20;
/** Fixture effects currently allowed in serialized Phase 6 state. */
export const KNOWN_EFFECT_IDS = new Set(['before', 'after', 'fixture']);
export type EffectRunner = (entry: Readonly<ScheduledEntry>) => void;

function allocate(scheduler: SchedulerState, entry: ScheduledEntry): number {
  const index = scheduler.slots.findIndex(slot => slot === null);
  if (index < 0) throw new Error('Scheduler is full');
  scheduler.slots[index] = entry;
  return index;
}

export function createScheduler(): SchedulerState {
  return { slots: Array.from({ length: SCHEDULER_CAPACITY }, () => null) };
}
export function startDaemon(s: SchedulerState, effect: string, arg: number, phase: ScheduledEntry['phase']): number {
  return allocate(s, { effect, arg, phase, remaining: -1 });
}
export function scheduleFuse(s: SchedulerState, effect: string, arg: number, phase: ScheduledEntry['phase'], delay: number): number {
  if (!Number.isSafeInteger(delay) || delay <= 0) throw new RangeError('Fuse delay must be positive');
  return allocate(s, { effect, arg, phase, remaining: delay });
}
function find(s: SchedulerState, effect: string): number { return s.slots.findIndex(entry => entry?.effect === effect); }
export function lengthen(s: SchedulerState, effect: string, amount: number): boolean {
  const index = find(s, effect); const entry = index < 0 ? null : s.slots[index];
  if (!entry || entry.remaining <= 0) return false;
  entry.remaining += amount; return true;
}
export function extinguish(s: SchedulerState, effect: string): boolean {
  const index = find(s, effect); if (index < 0) return false;
  s.slots[index] = null; return true;
}
export function killDaemon(s: SchedulerState, effect: string): boolean { return extinguish(s, effect); }
export function runDaemons(s: SchedulerState, phase: ScheduledEntry['phase'], run: EffectRunner): void {
  for (let i = 0; i < s.slots.length; i++) {
    const entry = s.slots[i];
    if (entry?.phase === phase && entry.remaining === -1) run(entry);
  }
}
export function runFuses(s: SchedulerState, phase: ScheduledEntry['phase'], run: EffectRunner): void {
  for (let i = 0; i < s.slots.length; i++) {
    const entry = s.slots[i];
    if (!entry || entry.phase !== phase || entry.remaining <= 0) continue;
    entry.remaining--;
    if (entry.remaining === 0) {
      s.slots[i] = null;
      run(entry);
    }
  }
}
