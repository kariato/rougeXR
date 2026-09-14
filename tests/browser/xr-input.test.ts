import { describe, expect, it } from 'vitest';
import { DebouncedXrIntent, directionFromForward } from '../../src/presentation/xr/input';

describe('XR discrete input', () => {
  it('maps controller forward vectors to the same eight engine directions', () => {
    expect(directionFromForward(0, -1)).toBe('N'); expect(directionFromForward(1, 0)).toBe('E');
    expect(directionFromForward(-1, 1)).toBe('SW');
  });

  it('captures one revision-checked action per intentional gesture window', () => {
    const input = new DebouncedXrIntent(300);
    expect(input.commit('N', 8, 1000)).toEqual({ expectedRevision: 8, action: { type: 'move', direction: 'N', pickup: true } });
    expect(input.commit('N', 8, 1100)).toBeNull();
    expect(input.commit('E', 9, 1300)).toEqual({ expectedRevision: 9, action: { type: 'move', direction: 'E', pickup: true } });
  });
});
