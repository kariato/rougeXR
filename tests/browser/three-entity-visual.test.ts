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
  it('shows attack, impact, and defeat even when a creature GLB is unavailable', () => {
    const actor = createActorVisual(0xffffff);
    const animated = actor.root.children[0]!;
    actor.playAttack();actor.mixer.update(.20);expect(animated.position.z).toBeGreaterThan(.1);
    actor.playHurt();actor.mixer.update(.12);expect(animated.rotation.z).toBeLessThan(-.1);
    actor.playDeath();actor.mixer.update(.7);expect(animated.rotation.x).toBeGreaterThan(1);
  });
  it('plays a strike and impact in order when both occur in one turn', () => {
    const actor=createActorVisual(0xffffff);const animated=actor.root.children[0]!;
    actor.playSequence(['attack','hurt']);actor.mixer.update(.20);expect(animated.position.z).toBeGreaterThan(.1);
    actor.mixer.update(.19);actor.mixer.update(.12);expect(animated.rotation.z).toBeLessThan(-.1);
  });
});
