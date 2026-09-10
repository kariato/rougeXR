import type { RandomState } from './model/state';

export function createRandom(seed: number): RandomState {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError('Seed must be uint32');
  return { algorithm: 'xorshift32-v1', word: seed === 0 ? 0x6d2b79f5 : seed, draws: 0 };
}
export function nextU32(r: RandomState): number {
  if (r.algorithm !== 'xorshift32-v1' || !Number.isInteger(r.word) || r.word < 1 || r.word > 0xffffffff
    || !Number.isSafeInteger(r.draws) || r.draws < 0 || r.draws === Number.MAX_SAFE_INTEGER) throw new RangeError('Invalid RNG state');
  let x = r.word >>> 0;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  r.word = x >>> 0;
  r.draws++;
  return r.word;
}
export function rnd(r: RandomState, range: number): number {
  if (!Number.isSafeInteger(range) || range < 0) throw new RangeError('Invalid random range');
  return range === 0 ? 0 : nextU32(r) % range;
}
export function roll(r: RandomState, count: number, sides: number): number {
  if (!Number.isSafeInteger(count) || count < 0 || !Number.isSafeInteger(sides) || sides < 0
    || !Number.isSafeInteger(count * Math.max(1, sides))) throw new RangeError('Invalid dice');
  let total = 0;
  for (let i = 0; i < count; i++) total += rnd(r, sides) + 1;
  return total;
}
