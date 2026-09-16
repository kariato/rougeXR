import { describe, expect, it } from 'vitest';
import type { PlayerObservation } from '../../src/engine/model/observation';
import { equippedWeaponAsset, weaponAssetKeys } from '../../src/presentation/three/weapon-asset';

function observation(assetKey: string | null, label = 'renamed by player'): PlayerObservation {
  return { revision: 0, levelId: 'test', width: 1, height: 1, playerAt: { x: 0, y: 0 }, cells: [], entities: [], decorations: [],
    status: { hp: 1, maxHp: 1, gold: 0, depth: 1, hungerStage: 0 }, pendingDecision: null,
    inventory: [{ token: 'item', label, quantity: 1, category: 'weapon', equippedSlot: 'weapon', assetKey }] };
}

describe('first-person weapon assets', () => {
  it('covers every Rogue weapon definition', () => {
    expect(weaponAssetKeys()).toEqual([
      'weapon.mace', 'weapon.long-sword', 'weapon.short-bow', 'weapon.arrow', 'weapon.dagger',
      'weapon.two-handed-sword', 'weapon.dart', 'weapon.shuriken', 'weapon.spear',
    ]);
  });

  it('selects the equipped model by definition identity rather than its label', () => {
    expect(equippedWeaponAsset(observation('weapon.short-bow'))?.id).toBe('short-bow');
    expect(equippedWeaponAsset(observation('unknown'))).toBeNull();
  });
});
