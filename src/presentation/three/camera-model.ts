export type CameraMode = 'firstPerson' | 'orbit' | 'tabletop';
import type { ActionRequest } from '../../engine/model/action';
import type { PlayerObservation } from '../../engine/model/observation';
import type { Direction } from '../../engine/model/state';

export interface SelectionHit<T> {
  distance: number;
  eligible: boolean;
  occludes: boolean;
  value: T;
}

/** Exponential smoothing has the same result for equal elapsed time at any frame rate. */
export function smoothToward(current: number, target: number, response: number, elapsedSeconds: number): number {
  if (elapsedSeconds <= 0) return current;
  return target + (current - target) * Math.exp(-Math.max(0, response) * elapsedSeconds);
}

/** Smooth one-way fall progress that stays at the final ground pose. */
export function deathFallProgress(startedAt: number | null, now: number, duration = 1400): number {
  if (startedAt === null) return 0;
  const linear = Math.max(0, Math.min(1, (now - startedAt) / duration));
  return linear * linear * (3 - 2 * linear);
}

/** Returns the nearest eligible hit, unless nearer geometry blocks it. */
export function nearestVisibleHit<T>(hits: SelectionHit<T>[]): T | null {
  for (const hit of [...hits].sort((a, b) => a.distance - b.distance)) {
    if (hit.eligible) return hit.value;
    if (hit.occludes) return null;
  }
  return null;
}

const DIRECTION_OFFSETS: Record<Direction, { x: number; y: number }> = {
  N: { x: 0, y: -1 }, NE: { x: 1, y: -1 }, E: { x: 1, y: 0 }, SE: { x: 1, y: 1 },
  S: { x: 0, y: 1 }, SW: { x: -1, y: 1 }, W: { x: -1, y: 0 }, NW: { x: -1, y: -1 },
};

/** Returns a bump-combat request only for a disclosed monster in the adjacent POV-forward cell. */
export function frontMonsterAttackRequest(observation: PlayerObservation, direction: Direction): ActionRequest | null {
  const offset = DIRECTION_OFFSETS[direction];
  const target = { x: observation.playerAt.x + offset.x, y: observation.playerAt.y + offset.y };
  if (!observation.entities.some(entity => entity.token.startsWith('monster-') && entity.at.x === target.x && entity.at.y === target.y)) return null;
  return { expectedRevision: observation.revision, action: { type: 'move', direction, pickup: true } };
}
