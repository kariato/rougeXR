import type { ActionRequest, ActionResolution, GameAction, PresentationEvent, RawEvent, RawEventInput, TraceEntry } from './model/action';
import type { ScheduledEntry, WorldState } from './model/state';
import { runDaemons, runFuses } from './scheduler';
import { validateWorld } from './validate';
import { resolveMove } from './rules/movement';
import { resolveSearch } from './rules/search';
import { isPositionVisible, updateKnowledge } from './perception/knowledge';
import { runMonsters } from './rules/combat';
import { collectAtPlayer, collectItem, dropItem, equipItem, unequipItem } from './rules/inventory';
import { eatItem } from './rules/inventory';
import { runStomach } from './rules/hunger';
import { recoverConfusion, recoverSight, rollWanderCheck, runDoctor, startWanderChecks } from './rules/effects';

export interface RuleResult { resolved: boolean; consumedSlot: boolean; reason: string | null; deferredPickup?: string | null }
export interface RuleContext { state: WorldState; emit(event: PresentationEvent): void; emitRaw(event: RawEventInput): void }
export type ActionHandler = (action: GameAction, context: RuleContext) => RuleResult;
export type EffectHandler = (state: WorldState, entry: Readonly<ScheduledEntry>, emitRaw: (event: RawEventInput) => void) => void;
export interface SessionOptions { actionHandler?: ActionHandler; effects?: Record<string, EffectHandler>; operationLimit?: number }
export class EngineFault extends Error {}

const detached = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export class GameSession {
  private state: WorldState;
  private readonly effects: Record<string, EffectHandler>;
  private readonly actionHandler: ActionHandler;
  private readonly operationLimit: number;
  private latestTrace: TraceEntry[] = [];
  private latestRaw: RawEvent[] = [];

  constructor(initial: WorldState, options: SessionOptions = {}) {
    this.state = detached(initial);
    this.effects = { runners: (state, _entry, emitRaw) => runMonsters(state, emitRaw),
      doctor: (state, _entry, emitRaw) => runDoctor(state, emitRaw),
      stomach: (state, _entry, emitRaw) => runStomach(state, emitRaw),
      swander: state => startWanderChecks(state), rollwand: state => rollWanderCheck(state),
      unconfuse: (state, _entry, emitRaw) => recoverConfusion(state, emitRaw),
      sight: (state, _entry, emitRaw) => recoverSight(state, emitRaw), ...(options.effects ?? {}) };
    this.actionHandler = options.actionHandler ?? defaultAction;
    this.operationLimit = options.operationLimit ?? 10000;
    this.prepareInitialBoundary();
  }
  observe(): Readonly<WorldState> { return detached(this.state); }
  exportState(): WorldState { return detached(this.state); }
  trace(): TraceEntry[] { return detached(this.latestTrace); }
  debugEvents(): RawEvent[] { return detached(this.latestRaw); }

  submit(request: ActionRequest): ActionResolution {
    if (!validRequest(request)) throw new TypeError('Malformed action request');
    if (request.expectedRevision !== this.state.timing.revision) throw new RangeError('Stale action request');
    if (this.state.timing.cycle.phase === 'terminal') throw new RangeError('Game is terminal');
    const draft = detached(this.state); const events: PresentationEvent[] = []; const raw: RawEvent[] = []; const trace: TraceEntry[] = [];
    const startTick = draft.timing.tick;
    try {
      draft.timing.actionSequence++;
      const emitRaw = (input: RawEventInput): void => {
        const event = { ...input, ordinal: raw.length, actionSequence: draft.timing.actionSequence } as RawEvent;
        raw.push(event); const safe = projectEvent(draft, event); if (safe) events.push(safe);
      };
      const result = this.actionHandler(request.action, { state: draft, emit: event => events.push(event), emitRaw });
      trace.push({ kind: 'action', detail: `${request.action.type}:${result.resolved ? 'resolved' : 'rejected'}`, tick: draft.timing.tick });
      if (result.deferredPickup) {
        const pickup = collectItem(draft, result.deferredPickup, emitRaw);
        trace.push({ kind: 'pickup', detail: `${pickup.resolved ? 'collected' : 'rejected'}:${result.deferredPickup}`, tick: draft.timing.tick });
      }
      if (result.consumedSlot) draft.timing.cycle.slotsRemaining--;
      this.pump(draft, trace, events, emitRaw);
      draft.timing.revision++;
      assertTiming(draft);
      const issues = validateWorld(draft); if (issues.length) throw new Error(issues[0]!.message);
      this.state = draft; this.latestTrace = trace; this.latestRaw = raw;
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
  private pump(state: WorldState, trace: TraceEntry[], events: PresentationEvent[], emitRaw: (event: RawEventInput) => void = () => {}): void {
    let operations = 0;
    const step = (): void => { if (++operations > this.operationLimit) throw new Error('Cycle operation limit exceeded'); };
    const effects = (entry: Readonly<ScheduledEntry>): boolean => {
      step(); trace.push({ kind: 'effect', detail: `${entry.phase}:${entry.effect}`, tick: state.timing.tick });
      const handler = this.effects[entry.effect]; if (!handler) throw new Error(`Unknown effect: ${entry.effect}`);
      handler(state, entry, emitRaw);
      return state.timing.status === 'playing';
    };
    while (true) {
      step();
      if (state.timing.status !== 'playing') { state.timing.cycle = { phase: 'terminal', slotsRemaining: 0 }; return; }
      if (state.timing.cycle.phase === 'begin') {
        state.timing.cycle.slotsRemaining = state.timing.hasted ? 2 : 1;
        trace.push({ kind: 'phase', detail: 'before', tick: state.timing.tick });
        runDaemons(state.timing.scheduler, 'before', effects); if (state.timing.status !== 'playing') continue;
        runFuses(state.timing.scheduler, 'before', effects); if (state.timing.status !== 'playing') continue;
        state.timing.cycle.phase = 'input';
      }
      if (state.timing.cycle.phase === 'input' && state.timing.cycle.slotsRemaining > 0 && state.timing.noCommand > 0) {
        state.timing.noCommand--; state.timing.cycle.slotsRemaining--;
        trace.push({ kind: 'action', detail: 'forced-rest', tick: state.timing.tick });
        if (state.timing.noCommand === 0) events.push({ type: 'message', text: 'You can move again.' });
        continue;
      }
      if (state.timing.cycle.phase === 'input' && state.timing.cycle.slotsRemaining > 0) {
        updateKnowledge(state);
        trace.push({ kind: 'inputReady', detail: `${state.timing.cycle.slotsRemaining} slot(s)`, tick: state.timing.tick }); return;
      }
      state.timing.cycle.phase = 'after';
      trace.push({ kind: 'phase', detail: 'after', tick: state.timing.tick });
      runDaemons(state.timing.scheduler, 'after', effects); if (state.timing.status !== 'playing') continue;
      runFuses(state.timing.scheduler, 'after', effects);
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
    result.events.forEach(context.emitRaw);
    return result;
  }
  if (action.type === 'search') return resolveSearch(context.state, context.emitRaw);
  if (action.type === 'pickup') return { ...collectAtPlayer(context.state, context.emitRaw), consumedSlot: true };
  if (action.type === 'drop') return dropItem(context.state, action.itemId, context.emitRaw);
  if (action.type === 'equip') return equipItem(context.state, action.itemId, action.slot, context.emitRaw);
  if (action.type === 'unequip') return unequipItem(context.state, action.slot, context.emitRaw);
  if (action.type === 'eat') return eatItem(context.state, action.itemId, context.emitRaw);
  if (action.name === 'free') return { resolved: true, consumedSlot: false, reason: null };
  return { resolved: false, consumedSlot: false, reason: `Unsupported fixture action: ${action.name}` };
}
function validRequest(value: unknown): value is ActionRequest {
  if (!value || typeof value !== 'object') return false;
  const request = value as Partial<ActionRequest>;
  return Number.isSafeInteger(request.expectedRevision) && request.action !== null && typeof request.action === 'object'
    && ((request.action as GameAction).type === 'rest' || (request.action as GameAction).type === 'search' || (request.action as GameAction).type === 'pickup'
      || ((request.action as GameAction).type === 'move'
        && Object.hasOwn({ N: 1, NE: 1, E: 1, SE: 1, S: 1, SW: 1, W: 1, NW: 1 }, (request.action as { direction?: string }).direction ?? '')
        && typeof (request.action as { pickup?: unknown }).pickup === 'boolean')
      || ((request.action as GameAction).type === 'drop' && typeof (request.action as { itemId?: unknown }).itemId === 'string')
      || ((request.action as GameAction).type === 'equip' && typeof (request.action as { itemId?: unknown }).itemId === 'string'
        && ['weapon', 'armor', 'leftRing', 'rightRing'].includes((request.action as { slot?: string }).slot ?? ''))
      || ((request.action as GameAction).type === 'unequip' && ['weapon', 'armor', 'leftRing', 'rightRing'].includes((request.action as { slot?: string }).slot ?? ''))
      || ((request.action as GameAction).type === 'eat' && typeof (request.action as { itemId?: unknown }).itemId === 'string')
      || ((request.action as GameAction).type === 'fixture' && typeof (request.action as { name?: unknown }).name === 'string'));
}
function projectEvent(state: WorldState, event: RawEvent): PresentationEvent | null {
  if (event.type === 'sourceMessage') return { type: 'message', text: event.text };
  if (event.type === 'featureRevealed') return { type: 'message', text: `You found ${event.feature}.` };
  if (event.type === 'attackResolved') {
    const subject = event.attackerId === 'player' ? 'You' : 'The kestrel';
    return { type: 'message', text: event.hit ? `${subject} hit for ${event.damage}.` : `${subject} missed.` };
  }
  if (event.type === 'hpChanged' || event.type === 'actorDefeated') return null;
  if (event.type === 'itemCollected' || event.type === 'itemDropped' || event.type === 'equipmentChanged' || event.type === 'itemConsumed') return { type: 'inventoryUpdate' };
  if (event.actorId === 'player' || isPositionVisible(state, event.from) || isPositionVisible(state, event.to)) {
    return { type: 'visibleMovement', token: event.actorId === 'player' ? 'player' : `monster-${event.actorId}`,
      from: { ...event.from }, to: { ...event.to } };
  }
  return null;
}
function assertTiming(state: WorldState): void {
  const t = state.timing;
  if (![t.revision, t.actionSequence, t.tick, t.noCommand, t.noMove].every(v => Number.isSafeInteger(v) && v >= 0)) throw new Error('Invalid timing counter');
  if (t.scheduler.slots.length !== 20) throw new Error('Invalid scheduler capacity');
  if (t.cycle.phase !== 'input' && t.cycle.phase !== 'terminal') throw new Error('State is not at an export boundary');
  if (t.cycle.phase === 'input' && (t.cycle.slotsRemaining < 1 || t.cycle.slotsRemaining > 2)) throw new Error('Invalid action slots');
}
