import { describe, expect, it } from 'vitest';
import { createActorVisual } from '../../src/presentation/three/entity-visual';

describe('3D actor visuals', () => {
  it('gives every actor an independent skeleton and animation mixer', () => {
    const first = createActorVisual(0xffffff);
    const second = createActorVisual(0xffffff);
    expect(first.skeleton).not.toBe(second.skeleton);
    expect(first.skeleton.bones[0]).not.toBe(second.skeleton.bones[0]);
    expect(first.mixer).not.toBe(second.mixer);
  });
});
