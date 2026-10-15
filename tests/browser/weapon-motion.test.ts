import { expect, it } from 'vitest';
import { weaponAttackPose } from '../../src/presentation/three/weapon-motion';
it('moves the weapon through windup and strike, then restores the ready pose', () => {
  const rest = weaponAttackPose(-1, 'mace');
  expect(weaponAttackPose(0, 'mace')).toEqual(rest);
  expect(weaponAttackPose(.25, 'mace').roll).toBeGreaterThan(.5);
  expect(weaponAttackPose(.55, 'mace').x).toBeLessThan(0);
  expect(weaponAttackPose(1, 'mace')).toEqual(rest);
  expect(weaponAttackPose(3, 'mace')).toEqual(rest);
  expect(weaponAttackPose(.55, 'spear').z).toBeLessThan(weaponAttackPose(.55, 'mace').z);
});
