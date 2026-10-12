import type { PlayerObservation } from '../../engine/model/observation';

export interface DoorFacing { dx: number; dz: number; yaw: number }

/** Disclosed room floors or the approaching corridor determine the door orientation. */
export function roomFacingForDoor(observation: PlayerObservation, x: number, z: number): DoorFacing | null {
  const door = observation.cells[z * observation.width + x];
  const token = door?.visualRegion?.token;
  if (door?.appearance?.terrainLabel !== 'door' || !token) return null;
  for (const [dx, dz] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
    const nx = x + dx, nz = z + dz;
    if (nx < 0 || nx >= observation.width || nz < 0 || nz >= observation.height) continue;
    const neighbor = observation.cells[nz * observation.width + nx];
    if (neighbor?.visibility === 'unknown' || neighbor?.visualRegion?.token !== token
      || neighbor.appearance?.terrainLabel !== 'floor') continue;
    return { dx, dz, yaw: Math.atan2(dx, dz) };
  }
  // The door itself is already disclosed. Its approaching corridor determines
  // the opposite swing direction without revealing any interior cells.
  for (const [dx, dz] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
    const nx = x + dx, nz = z + dz;
    if (nx < 0 || nx >= observation.width || nz < 0 || nz >= observation.height) continue;
    const neighbor = observation.cells[nz * observation.width + nx];
    if (neighbor?.visibility === 'unknown' || neighbor?.appearance?.terrainLabel !== 'passage') continue;
    return { dx: -dx, dz: -dz, yaw: Math.atan2(-dx, -dz) };
  }
  return null;
}

export function doorOpenProgress(openedAt: number | null, now: number, duration = 700): number {
  if (openedAt === null) return 0;
  const linear = Math.max(0, Math.min(1, (now - openedAt) / duration));
  return linear * linear * (3 - 2 * linear);
}
