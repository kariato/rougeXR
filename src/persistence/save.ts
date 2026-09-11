import type { WorldState } from '../engine/model/state';
import { GameSession, type SessionOptions } from '../engine/session';
import { validateWorld, type ValidationIssue } from '../engine/validate';

export const SAVE_FORMAT = 'rougexr-save' as const;
export const SAVE_VERSION = 1 as const;
export const UPSTREAM_REVISION = 'f4653c2a2ee6981a73abe9dfda055134285e1e79' as const;
export const MAX_SAVE_BYTES = 5 * 1024 * 1024;

export interface SaveEnvelope {
  format: typeof SAVE_FORMAT; version: typeof SAVE_VERSION;
  upstream: typeof UPSTREAM_REVISION; state: WorldState;
}
export type ParseSaveResult = { ok: true; value: SaveEnvelope } | { ok: false; errors: ValidationIssue[] };

export function createSaveEnvelope(state: WorldState): SaveEnvelope {
  return { format: SAVE_FORMAT, version: SAVE_VERSION, upstream: UPSTREAM_REVISION, state: detached(state) };
}
export function serializeSave(state: WorldState): string { return JSON.stringify(createSaveEnvelope(state), null, 2); }

export function parseSave(text: string): ParseSaveResult {
  if (new TextEncoder().encode(text).byteLength > MAX_SAVE_BYTES) return failure('save', 'Save exceeds 5 MiB limit');
  let input: unknown;
  try { input = JSON.parse(text); } catch { return failure('save', 'Invalid JSON'); }
  const complexity = inspectComplexity(input);
  if (complexity) return failure('save', complexity);
  if (!input || typeof input !== 'object' || Array.isArray(input)) return failure('save', 'Expected save envelope');
  const envelope = input as Partial<SaveEnvelope>;
  if (envelope.format !== SAVE_FORMAT) return failure('format', 'Unsupported save format');
  if (envelope.version !== SAVE_VERSION) return failure('version', 'Unsupported save version');
  if (envelope.upstream !== UPSTREAM_REVISION) return failure('upstream', 'Save uses a different rules revision');
  const errors = validateWorld(envelope.state);
  if (!errors.length) {
    const cycle = envelope.state!.timing.cycle.phase;
    if (cycle !== 'input' && cycle !== 'terminal') errors.push({ path: 'state.timing.cycle', message: 'Save is not at an input boundary' });
    if (cycle === 'input' && envelope.state!.timing.noCommand !== 0) errors.push({ path: 'state.timing.noCommand', message: 'Forced turns must finish before saving' });
  }
  return errors.length ? { ok: false, errors } : { ok: true, value: detached(envelope as SaveEnvelope) };
}

export function restoreGame(state: WorldState, options: SessionOptions = {}): GameSession {
  const errors = validateWorld(state);
  if (errors.length) throw new Error(`Invalid restore state: ${errors[0]!.path}: ${errors[0]!.message}`);
  if (state.timing.cycle.phase !== 'input' && state.timing.cycle.phase !== 'terminal') throw new Error('Restore state is not at an input boundary');
  if (state.timing.cycle.phase === 'input' && state.timing.noCommand !== 0) throw new Error('Restore state has pending forced turns');
  return new GameSession(detached(state), options);
}

const detached = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const failure = (path: string, message: string): ParseSaveResult => ({ ok: false, errors: [{ path, message }] });
function inspectComplexity(root: unknown): string | null {
  const pending: Array<{ value: unknown; depth: number }> = [{ value: root, depth: 0 }]; let nodes = 0;
  while (pending.length) {
    const current = pending.pop()!;
    if (++nodes > 100_000) return 'Save is structurally too large';
    if (current.depth > 100) return 'Save is nested too deeply';
    if (current.value && typeof current.value === 'object') {
      for (const value of Object.values(current.value)) pending.push({ value, depth: current.depth + 1 });
    }
  }
  return null;
}
