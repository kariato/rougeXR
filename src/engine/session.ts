import type { ActionRequest, ActionResolution, EngineEvent, GameAction, TraceEntry } from './model/action';
import type { ScheduledEntry, WorldState } from './model/state';
import { runDaemons, runFuses } from './scheduler';
import { validateWorld } from './validate';
import { resolveMove } from './rules/movement';

export interface RuleResult { resolved: boolean; consumedSlot: boolean; reason: string | null; deferredPickup?: string | null }
export interface RuleContext { state: WorldState; emit(event: EngineEvent): void }
export type ActionHandler = (action: GameAction, context: RuleContext) => RuleResult;
export type EffectHandler = (state: WorldState, entry: Readonly<ScheduledEntry>) => void;
export interface SessionOptions { actionHandler?: ActionHandler; effects?: Record<string, EffectHandler>; operationLimit?: number }
export class EngineFault extends Error {}

const detached = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export class GameSession {
  private state: WorldState;
  private readonly effects: Record<string, EffectHandler>;
  private readonly actionHandler: ActionHandler;
  private readonly operationLimit: number;
  private latestTrace: TraceEntry[] = [];

  constructor(initial: WorldState, options: SessionOptions = {}) {
    this.state = detached(initial);
    this.effects = options.effects ?? {};
    this.actionHandler = options.actionHandler ?? defaultAction;
    this.operationLimit = options.operationLimit ?? 10000;
    this.prepareInitialBoundary();
  }
  observe(): Readonly<WorldState> { return detached(this.state); }
  exportState(): WorldState { return detached(this.state); }
  trace(): TraceEntry[] { return detached(this.latestTrace); }

  submit(request: ActionRequest): ActionResolution {
    if (!validRequest(request)) throw new TypeError('Malformed action request');
    if (request.expectedRevision !== this.state.timing.revision) throw new RangeError('Stale action request');
    if (this.state.timing.cycle.phase === 'terminal') throw new RangeError('Game is terminal');
    const draft = detached(this.state); const events: EngineEvent[] = []; const trace: TraceEntry[] = [];
    const startTick = draft.timing.tick;
    try {
      draft.timing.actionSequence++;
      const result = this.actionHandler(request.action, { state: draft, emit: event => events.push(event) });
      trace.push({ kind: 'action', detail: `${request.action.type}:${result.resolved ? 'resolved' : 'rejected'}`, tick: draft.timing.tick });
      if (result.deferredPickup) trace.push({ kind: 'pickup', detail: `deferred:${result.deferredPickup}`, tick: draft.timing.tick });
      if (result.consumedSlot) draft.timing.cycle.slotsRemaining--;
      this.pump(draft, trace, events);
      draft.timing.revision++;
      assertTiming(draft);
      const issues = validateWorld(draft); if (issues.length) throw new Error(issues[0]!.message);
      this.state = draft; this.latestTrace = trace;
      return { actionSequence: draft.timing.actionSequence, status: result.resolved ? 'resolved' : 'rejected',
        reason: result.reason, consumedSlot: result.consumedSlot, ticksAdvanced: draft.timing.tick - startTick,
        revision: draft.timing.revision, events: detached(events) };
    } catch (error) {
      throw new EngineFault(error instanceof Error ? error.message : String(error));
    }
  }

  private prepareInitialBoundary(): void {
    const trace: TraceEntry[] = [];
    try { this.pump(this.state, trace, []); assertTiming(this.state); }
    catch (error) { throw new EngineFault(error instanceof Error ? error.message : String(error)); }
    this.latestTrace = trace;
  }
  private pump(state: WorldState, trace: TraceEntry[], events: EngineEvent[]): void {
    let operations = 0;
    const step = (): void => { if (++operations > this.operationLimit) throw new Error('Cycle operation limit exceeded'); };
    const effects = (entry: Readonly<ScheduledEntry>): void => {
      step(); trace.push({ kind: 'effect', detail: `${entry.phase}:${entry.effect}`, tick: state.timing.tick });
      const handler = this.effects[entry.effect]; if (!handler) throw new Error(`Unknown effect: ${entry.effect}`);
      handler(state, entry);
    };
    while (true) {
      step();
      if (state.timing.status !== 'playing') { state.timing.cycle = { phase: 'terminal', slotsRemaining: 0 }; return; }
      if (state.timing.cycle.phase === 'begin') {
        state.timing.cycle.slotsRemaining = state.timing.hasted ? 2 : 1;
        trace.push({ kind: 'phase', detail: 'before', tick: state.timing.tick });
        runDaemons(state.timing.scheduler, 'before', effects); runFuses(state.timing.scheduler, 'before', effects);
        state.timing.cycle.phase = 'input';
      }
      if (state.timing.cycle.phase === 'input' && state.timing.cycle.slotsRemaining > 0 && state.timing.noCommand > 0) {
        state.timing.noCommand--; state.timing.cycle.slotsRemaining--;
        trace.push({ kind: 'action', detail: 'forced-rest', tick: state.timing.tick });
        if (state.timing.noCommand === 0) events.push({ type: 'recovered', message: 'You can move again.' });
        continue;
      }
      if (state.timing.cycle.phase === 'input' && state.timing.cycle.slotsRemaining > 0) {
        trace.push({ kind: 'inputReady', detail: `${state.timing.cycle.slotsRemaining} slot(s)`, tick: state.timing.tick }); return;
      }
      state.timing.cycle.phase = 'after';
      trace.push({ kind: 'phase', detail: 'after', tick: state.timing.tick });
      runDaemons(state.timing.scheduler, 'after', effects); runFuses(state.timing.scheduler, 'after', effects);
      if (state.timing.status !== 'playing') continue;
      trace.push({ kind: 'ring', detail: 'left', tick: state.timing.tick });
      trace.push({ kind: 'ring', detail: 'right', tick: state.timing.tick });
      state.timing.tick++; state.timing.cycle = { phase: 'begin', slotsRemaining: 0 };
    }
  }
}

function defaultAction(action: GameAction, context: RuleContext): RuleResult {
  if (action.type === 'rest') return { resolved: true, consumedSlot: true, reason: null };
  if (action.type === 'move') {
    const result = resolveMove(context.state, action.direction, action.pickup);
    result.events.forEach(context.emit);
    return result;
  }
  if (action.name === 'free') return { resolved: true, consumedSlot: false, reason: null };
  return { resolved: false, consumedSlot: false, reason: `Unsupported fixture action: ${action.name}` };
}
function validRequest(value: unknown): value is ActionRequest {
  if (!value || typeof value !== 'object') return false;
  const request = value as Partial<ActionRequest>;
  return Number.isSafeInteger(request.expectedRevision) && request.action !== null && typeof request.action === 'object'
    && ((request.action as GameAction).type === 'rest'
      || ((request.action as GameAction).type === 'move'
        && Object.hasOwn({ N: 1, NE: 1, E: 1, SE: 1, S: 1, SW: 1, W: 1, NW: 1 }, (request.action as { direction?: string }).direction ?? '')
        && typeof (request.action as { pickup?: unknown }).pickup === 'boolean')
      || ((request.action as GameAction).type === 'fixture' && typeof (request.action as { name?: unknown }).name === 'string'));
}
function assertTiming(state: WorldState): void {
  const t = state.timing;
  if (![t.revision, t.actionSequence, t.tick, t.noCommand, t.noMove].every(v => Number.isSafeInteger(v) && v >= 0)) throw new Error('Invalid timing counter');
  if (t.scheduler.slots.length !== 20) throw new Error('Invalid scheduler capacity');
  if (t.cycle.phase !== 'input' && t.cycle.phase !== 'terminal') throw new Error('State is not at an export boundary');
  if (t.cycle.phase === 'input' && (t.cycle.slotsRemaining < 1 || t.cycle.slotsRemaining > 2)) throw new Error('Invalid action slots');
}
