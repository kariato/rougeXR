import type { ActionRequest } from '../../engine/model/action';
import type { Direction } from '../../engine/model/state';

export function directionFromForward(x: number, z: number): Direction {
  const angle = Math.atan2(x, -z);
  const directions: Direction[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return directions[(Math.round(angle / (Math.PI / 4)) + 8) % 8]!;
}

export class DebouncedXrIntent {
  private lastCommit = Number.NEGATIVE_INFINITY;
  constructor(private readonly cooldownMs = 350) {}

  commit(direction: Direction, expectedRevision: number, nowMs: number): ActionRequest | null {
    if (nowMs - this.lastCommit < this.cooldownMs) return null;
    this.lastCommit = nowMs;
    return { expectedRevision, action: { type: 'move', direction, pickup: true } };
  }

  reset(): void { this.lastCommit = Number.NEGATIVE_INFINITY; }
}
