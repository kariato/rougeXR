import type { PlayerObservation } from '../../engine/model/observation';

export interface WeaponAsset {
  id: string;
  url: string;
  scale: number;
}

const WEAPON_ASSETS: Record<string, WeaponAsset> = {
  'weapon.mace': { id: 'mace', url: '/assets/weapons/mace.glb?v=1', scale: 0.72 },
  'weapon.long-sword': { id: 'long-sword', url: '/assets/weapons/long-sword.glb?v=1', scale: 0.65 },
  'weapon.short-bow': { id: 'short-bow', url: '/assets/weapons/short-bow.glb?v=1', scale: 0.62 },
  'weapon.arrow': { id: 'arrow', url: '/assets/weapons/arrow.glb?v=1', scale: 0.85 },
  'weapon.dagger': { id: 'dagger', url: '/assets/weapons/dagger.glb?v=1', scale: 0.9 },
  'weapon.two-handed-sword': { id: 'two-handed-sword', url: '/assets/weapons/two-handed-sword.glb?v=1', scale: 0.52 },
  'weapon.dart': { id: 'dart', url: '/assets/weapons/dart.glb?v=1', scale: 1 },
  'weapon.shuriken': { id: 'shuriken', url: '/assets/weapons/shuriken.glb?v=1', scale: 0.9 },
  'weapon.spear': { id: 'spear', url: '/assets/weapons/spear.glb?v=1', scale: 0.48 },
};

/** Selects the equipped model from the disclosed definition id, never its player-editable label. */
export function equippedWeaponAsset(observation: PlayerObservation): WeaponAsset | null {
  const equipped = observation.inventory.find(item => item.category === 'weapon' && item.equippedSlot === 'weapon');
  return equipped?.assetKey ? WEAPON_ASSETS[equipped.assetKey] ?? null : null;
}

export function weaponAssetKeys(): string[] { return Object.keys(WEAPON_ASSETS); }
