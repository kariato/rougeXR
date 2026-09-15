import { describe, expect, it } from 'vitest';
import { MONSTER_DEFINITIONS } from '../../src/definitions/combat';
import { observedMonsterAsset } from '../../src/presentation/three/monster-asset';

describe('observed monster model selection', () => {
  it('covers every source monster glyph with its own runtime asset', () => {
    expect(MONSTER_DEFINITIONS).toHaveLength(26);
    for (const definition of MONSTER_DEFINITIONS) {
      const entity = { token: 'monster-e1', at: { x: 1, y: 1 }, appearance: definition.glyph, label: definition.glyph };
      expect(observedMonsterAsset(entity)).toBe(definition.id.slice('monster.'.length));
    }
  });

  it('does not choose a specific model for a disguise, detection, or hallucination', () => {
    for (const label of ['?', 'detected monster', 'cosmic creature']) {
      expect(observedMonsterAsset({ token: 'monster-e1', at: { x: 1, y: 1 }, appearance: 'K', label })).toBeNull();
    }
  });
});
