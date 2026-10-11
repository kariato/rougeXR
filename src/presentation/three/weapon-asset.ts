import { assetUrl } from "../../asset-url";
import type { PlayerObservation } from '../../engine/model/observation';

export interface WeaponAsset {
  id: string;
  url: string;
  scale: number;
}

const WEAPON_ASSETS: Record<string, WeaponAsset> = {
  'weapon.mace': { id: 'mace', url: assetUrl('assets/weapons/mace.glb?v=1'), scale: 0.72 },
  'weapon.long-sword': { id: 'long-sword', url: assetUrl('assets/weapons/long-sword.glb?v=1'), scale: 0.65 },
  'weapon.short-bow': { id: 'short-bow', url: assetUrl('assets/weapons/short-bow.glb?v=1'), scale: 0.62 },
  'weapon.arrow': { id: 'arrow', url: assetUrl('assets/weapons/arrow.glb?v=1'), scale: 0.85 },
  'weapon.dagger': { id: 'dagger', url: assetUrl('assets/weapons/dagger.glb?v=1'), scale: 0.9 },
  'weapon.two-handed-sword': { id: 'two-handed-sword', url: assetUrl('assets/weapons/two-handed-sword.glb?v=1'), scale: 0.52 },
  'weapon.dart': { id: 'dart', url: assetUrl('assets/weapons/dart.glb?v=1'), scale: 1 },
  'weapon.shuriken': { id: 'shuriken', url: assetUrl('assets/weapons/shuriken.glb?v=1'), scale: 0.9 },
  'weapon.spear': { id: 'spear', url: assetUrl('assets/weapons/spear.glb?v=1'), scale: 0.48 },
};

/** Selects the equipped model from the disclosed definition id, never its player-editable label. */
export function equippedWeaponAsset(observation: PlayerObservation): WeaponAsset | null {
  const equipped = observation.inventory.find(item => item.category === 'weapon' && item.equippedSlot === 'weapon');
  return equipped?.assetKey ? WEAPON_ASSETS[equipped.assetKey] ?? null : null;
}

export function weaponAssetKeys(): string[] { return Object.keys(WEAPON_ASSETS); }
