import type { GameAction } from '../engine/model/action';
import type { WorldState } from '../engine/model/state';
import { hashState } from './canonical';
import { createSaveEnvelope, MAX_SAVE_BYTES, parseSave, restoreGame, type SaveEnvelope } from './save';

export interface ReplayEntry { action: GameAction; expectedRevision: number; expectedHash: string }
export interface ReplayBundle { format: 'rougexr-replay'; version: 1; initial: SaveEnvelope; entries: ReplayEntry[] }
export interface ReplayResult { ok: boolean; completed: number; expectedHash?: string; actualHash?: string }
export type ParseReplayResult = { ok: true; value: ReplayBundle } | { ok: false; error: string };

export class ReplayRecorder {
  private readonly initial: SaveEnvelope;
  private readonly entries: ReplayEntry[] = [];
  constructor(initialState: WorldState) { this.initial = createSaveEnvelope(initialState); }
  async record(action: GameAction, expectedRevision: number, resultingState: WorldState): Promise<void> {
    this.entries.push({ action: detached(action), expectedRevision, expectedHash: await hashState(resultingState) });
  }
  bundle(): ReplayBundle { return { format: 'rougexr-replay', version: 1, initial: detached(this.initial), entries: detached(this.entries) }; }
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
  if (bundle.entries.length > 1000) return { ok: false, error: 'Replay exceeds 1000 actions' };
  const initial = parseSave(JSON.stringify(bundle.initial));
  if (!initial.ok) return { ok: false, error: `Invalid replay checkpoint: ${initial.errors[0]?.message ?? 'unknown error'}` };
  for (const entry of bundle.entries) {
    if (!entry || !Number.isSafeInteger(entry.expectedRevision) || entry.expectedRevision < 0
      || typeof entry.expectedHash !== 'string' || !/^[0-9a-f]{64}$/.test(entry.expectedHash)
      || !validAction(entry.action)) return { ok: false, error: 'Invalid replay entry' };
  }
  return { ok: true, value: { ...detached(bundle as ReplayBundle), initial: initial.value } };
}

const DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const EQUIPMENT_SLOTS = ['weapon', 'armor', 'leftRing', 'rightRing'];

function validAction(value: unknown): value is GameAction {
  if (!value || typeof value !== 'object') return false;
  const action = value as Record<string, unknown>;
  switch (action.type) {
    case 'rest': case 'search': case 'pickup': return true;
    case 'fixture': return typeof action.name === 'string';
    case 'drop': case 'eat': return typeof action.itemId === 'string';
    case 'unequip': return typeof action.slot === 'string' && EQUIPMENT_SLOTS.includes(action.slot);
    case 'equip': return typeof action.itemId === 'string' && typeof action.slot === 'string' && EQUIPMENT_SLOTS.includes(action.slot);
    case 'move': return typeof action.direction === 'string' && DIRECTIONS.includes(action.direction) && typeof action.pickup === 'boolean';
    default: return false;
  }
}

const detached = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
