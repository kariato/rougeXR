import { describe, expect, it } from 'vitest';
import { XrEyeHeight, XR_METRES_PER_TILE } from '../../src/presentation/xr/physical-scale';
import { XrThumbsticks } from '../../src/presentation/xr/thumbstick';

describe('XR physical height', () => {
  it.each([0, 1.6, -0.2])('calibrates a local origin at %s metres without double-counting height', y => {
    const height = new XrEyeHeight();
    expect(height.offset(Number.NaN)).toBe(1.65);
    expect(height.offset(y) + y).toBeCloseTo(1.65);
    expect(height.offset(y - .3) + y - .3).toBeCloseTo(1.35); // Preserve crouching.
    height.reset(); expect(height.offset(y - .3) + y - .3).toBeCloseTo(1.65);
  });
  it('gives the dungeon an adult-sized doorway and room height', () => {
    expect(1.72 * XR_METRES_PER_TILE).toBeCloseTo(2.58);
    expect(1.8 * XR_METRES_PER_TILE).toBeCloseTo(2.7);
  });
});

describe('XR thumbstick locomotion', () => {
  it('reads standard axes 2/3, ignores drift, and turns once until centred', () => {
    const sticks = new XrThumbsticks(), source = { gamepad: { axes: [0, 0, .1, .1] } };
    expect(sticks.sample(source, 0, true)).toBeNull();
    source.gamepad.axes = [0, 0, 1, 0];
    expect(sticks.sample(source, 10, true)).toEqual({ type: 'turn', degrees: 45 });
    expect(sticks.sample(source, 1000, true)).toBeNull();
    source.gamepad.axes = [0, 0, 0, -1]; // Direction lock prevents accidental travel during a turn.
    expect(sticks.sample(source, 1100, true)).toBeNull();
    source.gamepad.axes = [0, 0, 0, 0]; sticks.sample(source, 1200, true);
    source.gamepad.axes = [0, 0, -1, 0];
    expect(sticks.sample(source, 1300, true)).toEqual({ type: 'turn', degrees: -45 });
  });
  it('moves forward/back using two-axis fallback and a controlled repeat rate', () => {
    const sticks = new XrThumbsticks(), source = { gamepad: { axes: [0, -1] } };
    expect(sticks.sample(source, 0, true)).toEqual({ type: 'move', forward: true });
    expect(sticks.sample(source, 399, true)).toBeNull();
    expect(sticks.sample(source, 400, true)).toEqual({ type: 'move', forward: true });
    source.gamepad.axes = [0, 0]; sticks.sample(source, 410, true);
    source.gamepad.axes = [0, 1];
    expect(sticks.sample(source, 420, true)).toEqual({ type: 'move', forward: false });
  });
  it('requires neutral after menus or tracking loss and tolerates missing controllers', () => {
    const sticks = new XrThumbsticks(), source = { gamepad: { axes: [0, 0, 1, 0] } };
    expect(sticks.sample({}, 0, true)).toBeNull();
    sticks.sample(source, 0, false);
    expect(sticks.sample(source, 1000, true)).toBeNull();
    source.gamepad.axes = [0, 0, 0, 0]; sticks.sample(source, 1100, true);
    source.gamepad.axes = [0, 0, 1, 0];
    expect(sticks.sample(source, 1200, true)).toEqual({ type: 'turn', degrees: 45 });
  });
});
