import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCOMOTION, parseLocomotionPreferences, XrLocomotion } from '../../src/presentation/xr/locomotion';

const start = { x: 5, z: 5 }, finish = { x: 6, z: 5 };

describe('XR comfort movement', () => {
  it('starts in comfort mode and changes position only at full fade', () => {
    const motion = new XrLocomotion(); motion.reset(start); motion.moveTo(finish, 1000);
    expect(motion.sample(1000)).toEqual({ ...start, fade: 0, vignette: 0, moving: true });
    expect(motion.sample(1037.5)).toMatchObject({ ...start, fade: .5 });
    expect(motion.sample(1074).x).toBe(start.x);
    expect(motion.sample(1075)).toEqual({ ...finish, fade: 1, vignette: 0, moving: true });
    expect(motion.sample(1142.5).fade).toBeCloseTo(.5);
    expect(motion.sample(1180)).toEqual({ ...finish, fade: 0, vignette: 0, moving: false });
    expect(motion.sample(9000).moving).toBe(false);
  });
  it('does not animate an unchanged position or initial spawn', () => {
    const motion = new XrLocomotion(); motion.moveTo(start, 0); motion.moveTo(start, 100);
    expect(motion.sample(100)).toEqual({ ...start, fade: 0, vignette: 0, moving: false });
  });
  it('retargets repeated movement without jumping while visible', () => {
    const motion = new XrLocomotion(); motion.reset(start); motion.moveTo(finish, 0);
    const before = motion.sample(45);
    motion.moveTo({ x: 7, z: 5 }, 45);
    expect(motion.sample(45)).toEqual(before);
    expect(motion.sample(119).x).toBe(start.x);
    expect(motion.sample(120)).toMatchObject({ x: 7, fade: 1 });
  });
  it('still covers the position change when frames stall past the normal fade time', () => {
    const motion = new XrLocomotion(); motion.reset(start); motion.moveTo(finish, 0);
    expect(motion.sample(500)).toEqual({ ...finish, fade: 1, vignette: 0, moving: true });
    expect(motion.sample(520).fade).toBe(1);
    expect(motion.sample(605)).toEqual({ ...finish, fade: 0, vignette: 0, moving: false });
  });
  it('covers a level transition even when its coordinates do not change', () => {
    const motion = new XrLocomotion(); motion.reset(start); motion.moveTo(start, 0, true);
    expect(motion.sample(0).fade).toBe(1);
  });
  it('clears active transitions on reset', () => {
    const motion = new XrLocomotion(); motion.reset(start); motion.moveTo(finish, 0); motion.reset();
    motion.moveTo({ x: 30, z: 12 }, 30);
    expect(motion.sample(30)).toEqual({ x: 30, z: 12, fade: 0, vignette: 0, moving: false });
  });
});

describe('XR glide movement', () => {
  it('interpolates one square over 300 ms without blacking out the center', () => {
    const motion = new XrLocomotion(); motion.configure({ movement: 'glide', vignette: true });
    motion.reset(start); motion.moveTo(finish, 0);
    const middle = motion.sample(150);
    expect(middle).toEqual({ x: 5.5, z: 5, fade: 0, vignette: .85, moving: true });
    expect(motion.sample(30).x).toBeGreaterThan(start.x);
    expect(motion.sample(270).x).toBeLessThan(finish.x);
    expect(motion.sample(300)).toEqual({ ...finish, fade: 0, vignette: 0, moving: false });
  });
  it('can disable the vignette without disabling glide', () => {
    const motion = new XrLocomotion(); motion.configure({ movement: 'glide', vignette: false });
    motion.reset(start); motion.moveTo(finish, 0);
    expect(motion.sample(150)).toEqual({ x: 5.5, z: 5, fade: 0, vignette: 0, moving: true });
  });
  it('supports diagonal steps and retargets from the current visual position', () => {
    const motion = new XrLocomotion(); motion.configure({ movement: 'glide', vignette: false });
    motion.reset(start); motion.moveTo({ x: 6, z: 6 }, 0);
    expect(motion.sample(150)).toMatchObject({ x: 5.5, z: 5.5 });
    motion.moveTo({ x: 6, z: 5 }, 150);
    expect(motion.sample(150)).toMatchObject({ x: 5.5, z: 5.5, fade: 0 });
    expect(motion.sample(450)).toMatchObject({ x: 6, z: 5, moving: false });
  });
  it.each([false, true])('fades long jumps and explicit teleports even in glide mode (%s)', teleport => {
    const motion = new XrLocomotion(); motion.configure({ movement: 'glide', vignette: false });
    motion.reset(start); motion.moveTo(teleport ? finish : { x: 20, z: 20 }, 0, teleport);
    expect(motion.sample(90).fade).toBe(1);
    expect(motion.sample(90).vignette).toBe(0);
  });
});

describe('locomotion preferences', () => {
  it('restores valid options', () => {
    expect(parseLocomotionPreferences('{"movement":"glide","vignette":false}')).toEqual({ movement: 'glide', vignette: false });
  });
  it.each([null, '{', '{}', '{"movement":"fast","vignette":true}', '{"movement":"glide","vignette":"false"}'])('defaults safely for %s', text => {
    expect(parseLocomotionPreferences(text)).toEqual(DEFAULT_LOCOMOTION);
  });
});
