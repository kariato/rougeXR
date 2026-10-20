import { describe, expect, it } from 'vitest';
import { defaultCheckpointName } from '../../src/persistence/checkpoint-name';
import { randomWorldSeed } from '../../src/input/random-seed';

describe('automatic game labels and seeds', () => {
  it('names checkpoints with local date, time, and the actual world seed', () => {
    expect(defaultCheckpointName(4294967295, new Date(2026, 9, 20, 9, 4, 2))).toBe('2026-10-20 09:04:02 · seed 4294967295');
  });
  it('changes repeated random seeds and wraps at the unsigned limit', () => {
    expect(randomWorldSeed(12, 12)).toBe(13);
    expect(randomWorldSeed(4294967295, 4294967295)).toBe(0);
    expect(randomWorldSeed(12, 0)).toBe(0);
  });
});
