import type { GameAction } from '../engine/model/action';
import type { WorldState } from '../engine/model/state';
import { hashState } from './canonical';
import { createSaveEnvelope, MAX_SAVE_BYTES, parseSave, restoreGame, type SaveEnvelope } from './save';

export interface ReplayEntry { action: GameAction; expectedRevision: number; expectedHash: string }
export interface ReplayBundle { format: 'rougexr-replay'; version: 1; initial: SaveEnvelope; entries: ReplayEntry[] }
export interface ReplayResult { ok: boolean; completed: number; expectedHash?: string; actualHash?: string }
export type ParseReplayResult = { ok: true; value: ReplayBundle } | { ok: false; error: string };
export const MAX_REPLAY_ENTRIES = 1000;

export class ReplayRecorder {
  private initial: SaveEnvelope;
  private readonly entries: ReplayEntry[] = [];
  constructor(initialState: WorldState, private readonly maxEntries = MAX_REPLAY_ENTRIES) {
    if (!Number.isSafeInteger(maxEntries) || maxEntries < 1 || maxEntries > MAX_REPLAY_ENTRIES) {
      throw new RangeError(`Replay capacity must be between 1 and ${MAX_REPLAY_ENTRIES}`);
    }
    this.initial = createSaveEnvelope(initialState);
  }
  async record(action: GameAction, expectedRevision: number, resultingState: WorldState): Promise<void> {
    const entry = { action: detached(action), expectedRevision, expectedHash: await hashState(resultingState) };
    if (this.entries.length === this.maxEntries) await this.advanceCheckpoint();
    this.entries.push(entry);
  }
  bundle(): ReplayBundle { return { format: 'rougexr-replay', version: 1, initial: detached(this.initial), entries: detached(this.entries) }; }

  private async advanceCheckpoint(): Promise<void> {
    const evicted = this.entries[0];
    if (!evicted) return;
    const checkpoint = restoreGame(this.initial.state);
    checkpoint.submit({ expectedRevision: evicted.expectedRevision, action: detached(evicted.action) });
    const actualHash = await hashState(checkpoint.exportState());
    if (actualHash !== evicted.expectedHash) throw new Error('Cannot rotate a divergent replay checkpoint');
    this.initial = createSaveEnvelope(checkpoint.exportState());
    this.entries.shift();
  }
}

export async function replay(bundle: ReplayBundle): Promise<ReplayResult> {
  return (await reproduceReplay(bundle)).result;
}

export async function reproduceReplay(bundle: ReplayBundle): Promise<{ result: ReplayResult; state: WorldState }> {
  const session = restoreGame(bundle.initial.state);
  for (let index = 0; index < bundle.entries.length; index++) {
    const entry = bundle.entries[index]!;
    session.submit({ expectedRevision: entry.expectedRevision, action: detached(entry.action) });
    const actualHash = await hashState(session.exportState());
    if (actualHash !== entry.expectedHash) return { result: { ok: false, completed: index, expectedHash: entry.expectedHash, actualHash }, state: session.exportState() };
  }
  return { result: { ok: true, completed: bundle.entries.length }, state: session.exportState() };
}

export function parseReplay(text: string): ParseReplayResult {
  if (new TextEncoder().encode(text).byteLength > MAX_SAVE_BYTES * 2) return { ok: false, error: 'Replay exceeds 10 MiB limit' };
  let value: unknown;
  try { value = JSON.parse(text); } catch { return { ok: false, error: 'Invalid JSON' }; }
  if (!value || typeof value !== 'object') return { ok: false, error: 'Expected replay bundle' };
  const bundle = value as Partial<ReplayBundle>;
  if (bundle.format !== 'rougexr-replay' || bundle.version !== 1 || !bundle.initial || !Array.isArray(bundle.entries)) {
    return { ok: false, error: 'Unsupported replay bundle' };
  }
  if (bundle.entries.length > MAX_REPLAY_ENTRIES) return { ok: false, error: `Replay exceeds ${MAX_REPLAY_ENTRIES} actions` };
  const initial = parseSave(JSON.stringify(bundle.initial));
  if (!initial.ok) return { ok: false, error: `Invalid replay checkpoint: ${initial.errors[0]?.message ?? 'unknown error'}` };
  for (const entry of bundle.entries) {
    if (!entry || !Number.isSafeInteger(entry.expectedRevision) || entry.expectedRevision < 0
      || typeof entry.expectedHash !== 'string' || !/^[0-9a-f]{64}$/.test(entry.expectedHash)
      || !validAction(entry.action)) return { ok: false, error: 'Invalid replay entry' };
  }
  return { ok: true, value: { ...detached(bundle as ReplayBundle), initial: initial.value } };
}

function validAction(value: unknown): value is GameAction {
  if (!value || typeof value !== 'object') return false;
  const action = value as Partial<GameAction> & { direction?: unknown; pickup?: unknown; name?: unknown };
  if (action.type === 'rest' || action.type === 'search' || action.type === 'pickup' || action.type === 'descend') return true;
  if (action.type === 'fixture') return typeof action.name === 'string';
  if (action.type === 'move') return typeof action.direction === 'string'
    && ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'].includes(action.direction) && typeof action.pickup === 'boolean';
  if (action.type === 'drop' || action.type === 'eat' || action.type === 'drink') return typeof (action as { itemId?: unknown }).itemId === 'string';
  if (action.type === 'unequip') return typeof (action as { slot?: unknown }).slot === 'string'
    && ['weapon', 'armor', 'leftRing', 'rightRing'].includes((action as { slot: string }).slot);
  return action.type === 'equip' && typeof (action as { itemId?: unknown }).itemId === 'string'
    && typeof (action as { slot?: unknown }).slot === 'string' && ['weapon', 'armor', 'leftRing', 'rightRing'].includes((action as { slot: string }).slot);
}

const detached = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
