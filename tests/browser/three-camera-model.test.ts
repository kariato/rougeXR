import { describe, expect, it } from 'vitest';
import { nearestVisibleHit, smoothToward } from '../../src/presentation/three/camera-model';

describe('desktop 3D camera model', () => {
  it('smooths identically for equivalent elapsed time', () => {
    const oneStep = smoothToward(0, 10, 8, 1);
    let manySteps = 0;
    for (let index = 0; index < 60; index++) manySteps = smoothToward(manySteps, 10, 8, 1 / 60);
    expect(manySteps).toBeCloseTo(oneStep, 10);
  });

  it('sorts hits and stops selection at nearer occluding geometry', () => {
    expect(nearestVisibleHit([
      { distance: 5, eligible: true, occludes: false, value: 'far' },
      { distance: 2, eligible: true, occludes: false, value: 'near' },
    ])).toBe('near');
    expect(nearestVisibleHit([
      { distance: 5, eligible: true, occludes: false, value: 'hidden' },
      { distance: 2, eligible: false, occludes: true, value: 'wall' },
    ])).toBeNull();
  });
});
