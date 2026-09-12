import type { ActionResolution } from '../engine/model/action';
import type { GameAction } from '../engine/model/action';
import { GameSession } from '../engine/session';
import { hashState } from './canonical';
import type { ReplayBundle } from './replay';
import { restoreGame } from './save';

export type ReplayStepResult =
  | { status: 'advanced' | 'complete'; index: number; total: number; resolution: ActionResolution }
  | { status: 'diverged'; index: number; total: number; action: GameAction; expectedHash: string; actualHash: string; resolution: ActionResolution };

export class ReplayPlayer {
  private current: GameSession;
  private cursor = 0;
  private stopped = false;

  constructor(private readonly replay: ReplayBundle) { this.current = restoreGame(replay.initial.state); }

  session(): GameSession { return this.current; }
  index(): number { return this.cursor; }
  total(): number { return this.replay.entries.length; }
  canStep(): boolean { return !this.stopped && this.cursor < this.replay.entries.length; }

  restart(): GameSession {
    this.current = restoreGame(this.replay.initial.state); this.cursor = 0; this.stopped = false;
    return this.current;
  }

  async step(): Promise<ReplayStepResult> {
    if (!this.canStep()) throw new RangeError('Replay has no next action');
    const entry = this.replay.entries[this.cursor]!;
    const resolution = this.current.submit({ expectedRevision: entry.expectedRevision, action: entry.action });
    const actualHash = await hashState(this.current.exportState());
    if (actualHash !== entry.expectedHash) {
      this.stopped = true;
      return { status: 'diverged', index: this.cursor, total: this.total(), action: structuredClone(entry.action), expectedHash: entry.expectedHash, actualHash, resolution };
    }
    this.cursor++;
    return { status: this.cursor === this.total() ? 'complete' : 'advanced', index: this.cursor, total: this.total(), resolution };
  }
}
