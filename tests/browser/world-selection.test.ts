import { describe, expect, it } from 'vitest';
import { createSelectedWorld, parseSeed } from '../../src/app/world-selection';
import { validateWorld } from '../../src/engine/validate';

describe('browser world selection', () => {
  it('creates a deterministic generated world by default', () => {
    const left = createSelectedWorld('generated', 12345);
    const right = createSelectedWorld('generated', 12345);
    expect(left).toEqual(right);
    expect(left.level.rooms).toHaveLength(9);
    expect(validateWorld(left)).toEqual([]);
  });

  it.each(['kestrel', 'rooms'] as const)('keeps the %s debug fixture available', mode => {
    const state = createSelectedWorld(mode, 17);
    expect(state.seed).toBe(17);
    expect(validateWorld(state)).toEqual([]);
  });

  it('accepts only unsigned 32-bit integer seeds', () => {
    expect(parseSeed('0')).toBe(0);
    expect(parseSeed('4294967295')).toBe(0xffffffff);
    for (const invalid of ['', '-1', '1.5', '4294967296', 'seed']) {
      expect(() => parseSeed(invalid)).toThrow('Enter a seed');
    }
  });
});
