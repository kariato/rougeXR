export const WEAPON_ATTACK_DURATION = 560;
export interface WeaponPose { x: number; y: number; z: number; pitch: number; yaw: number; roll: number }
const rest: WeaponPose = { x: .36, y: -.34, z: -.63, pitch: 0, yaw: 0, roll: 0 };
/** Wind up, strike across the center of the view, then return to the ready pose. */
export function weaponAttackPose(progress: number, weapon: string | null): WeaponPose {
  if (progress < 0 || progress >= 1) return { ...rest };
  const thrust = weapon === 'spear' || weapon === 'dagger' || weapon === 'arrow' || weapon === 'dart';
  const windup: WeaponPose = { x: .42, y: -.22, z: -.49, pitch: .35, yaw: -.3, roll: .7 };
  const strike: WeaponPose = thrust
    ? { x: .08, y: -.2, z: -.98, pitch: -.4, yaw: .15, roll: -.15 }
    : { x: -.16, y: -.12, z: -.78, pitch: -1.15, yaw: .55, roll: -1.05 };
  const [from, to, t] = progress < .25 ? [rest, windup, progress / .25]
    : progress < .55 ? [windup, strike, (progress - .25) / .3]
      : [strike, rest, (progress - .55) / .45];
  const eased = t * t * (3 - 2 * t);
  const pose = { ...rest };
  for (const key of Object.keys(pose) as Array<keyof WeaponPose>) pose[key] = from[key] + (to[key] - from[key]) * eased;
  return pose;
}
