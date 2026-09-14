export type CameraMode = 'firstPerson' | 'orbit' | 'tabletop';

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

/** Returns the nearest eligible hit, unless nearer geometry blocks it. */
export function nearestVisibleHit<T>(hits: SelectionHit<T>[]): T | null {
  for (const hit of [...hits].sort((a, b) => a.distance - b.distance)) {
    if (hit.eligible) return hit.value;
    if (hit.occludes) return null;
  }
  return null;
}
