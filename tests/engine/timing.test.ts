import { describe, expect, it } from 'vitest';
import { createTwoRoomFixture } from '../../src/debug/fixtures';
import type { ActionHandler } from '../../src/engine/session';
import { EngineFault, GameSession } from '../../src/engine/session';
import { createScheduler, runFuses, scheduleFuse, startDaemon } from '../../src/engine/scheduler';

describe('scheduler', () => {
  it('runs daemons and fuses in live slot order', () => {
    const scheduler = createScheduler(); const calls: string[] = [];
    scheduleFuse(scheduler, 'first', 0, 'after', 1);
    scheduleFuse(scheduler, 'later', 0, 'after', 1);
    runFuses(scheduler, 'after', entry => {
      calls.push(entry.effect);
      if (entry.effect === 'first') {
        scheduleFuse(scheduler, 'replacement', 0, 'after', 1);
        scheduleFuse(scheduler, 'inserted', 0, 'after', 1);
      }
    });
    expect(calls).toEqual(['first', 'later', 'inserted']);
  });
  it('clears an expired fuse before callback reuse and does not revisit the slot', () => {
    const scheduler = createScheduler(); const calls: string[] = [];
    scheduleFuse(scheduler, 'first', 0, 'before', 1);
    runFuses(scheduler, 'before', entry => { calls.push(entry.effect); scheduleFuse(scheduler, 'replacement', 0, 'before', 1); });
    expect(calls).toEqual(['first']);
    expect(scheduler.slots[0]?.effect).toBe('replacement');
    runFuses(scheduler, 'before', entry => calls.push(entry.effect));
    expect(calls).toEqual(['first', 'replacement']);
  });
  it('faults without mutation when all slots are occupied', () => {
    const scheduler = createScheduler();
    for (let i = 0; i < 20; i++) startDaemon(scheduler, `d${i}`, 0, 'after');
    const before = structuredClone(scheduler);
    expect(() => scheduleFuse(scheduler, 'overflow', 0, 'after', 1)).toThrow('full');
    expect(scheduler).toEqual(before);
  });
});

describe('command timing session', () => {
  it('completes a normal rest cycle and starts BEFORE once for the next cycle', () => {
    const state = createTwoRoomFixture();
    startDaemon(state.timing.scheduler, 'before', 0, 'before');
    startDaemon(state.timing.scheduler, 'after', 0, 'after');
    const calls: string[] = [];
    const session = new GameSession(state, { effects: {
      before: s => { calls.push(`before:${s.timing.tick}`); }, after: s => { calls.push(`after:${s.timing.tick}`); }
    }});
    expect(calls).toEqual(['before:0']);
    const result = session.submit({ expectedRevision: 0, action: { type: 'rest' } });
    expect(result.ticksAdvanced).toBe(1);
    expect(calls).toEqual(['before:0', 'after:0', 'before:1']);
    expect(session.exportState().timing.cycle).toEqual({ phase: 'input', slotsRemaining: 1 });
  });
  it('uses two hasted slots and runs AFTER only after the second', () => {
    const state = createTwoRoomFixture(); state.timing.hasted = true;
    startDaemon(state.timing.scheduler, 'after', 0, 'after'); let after = 0;
    const session = new GameSession(state, { effects: { after: () => { after++; } } });
    expect(session.submit({ expectedRevision: 0, action: { type: 'rest' } }).ticksAdvanced).toBe(0);
    expect(after).toBe(0);
    expect(session.submit({ expectedRevision: 1, action: { type: 'rest' } }).ticksAdvanced).toBe(1);
    expect(after).toBe(1);
  });
  it('records a rule rejection without consuming a slot or repeating BEFORE', () => {
    const state = createTwoRoomFixture(); let before = 0;
    startDaemon(state.timing.scheduler, 'before', 0, 'before');
    const session = new GameSession(state, { effects: { before: () => { before++; } } });
    const result = session.submit({ expectedRevision: 0, action: { type: 'fixture', name: 'blocked' } });
    expect(result).toMatchObject({ status: 'rejected', consumedSlot: false, ticksAdvanced: 0, revision: 1, actionSequence: 1 });
    expect(before).toBe(1);
  });
  it('resolves a free command without advancing or restarting the cycle', () => {
    const state = createTwoRoomFixture(); let before = 0;
    startDaemon(state.timing.scheduler, 'before', 0, 'before');
    const session = new GameSession(state, { effects: { before: () => { before++; } } });
    const result = session.submit({ expectedRevision: 0, action: { type: 'fixture', name: 'free' } });
    expect(result).toMatchObject({ status: 'resolved', consumedSlot: false, ticksAdvanced: 0, revision: 1 });
    expect(session.exportState().timing.cycle.slotsRemaining).toBe(1);
    expect(before).toBe(1);
  });
  it('rejects stale and malformed requests without changing state', () => {
    const session = new GameSession(createTwoRoomFixture()); const before = session.exportState();
    expect(() => session.submit({ expectedRevision: 9, action: { type: 'rest' } })).toThrow('Stale');
    expect(() => session.submit({ expectedRevision: 0, action: { type: 'other' } } as never)).toThrow('Malformed');
    expect(session.exportState()).toEqual(before);
  });
  it('rolls back an internal handler fault', () => {
    const handler: ActionHandler = (_action, { state }) => { state.player.stats.hp = 1; throw new Error('fixture failure'); };
    const session = new GameSession(createTwoRoomFixture(), { actionHandler: handler }); const before = session.exportState();
    expect(() => session.submit({ expectedRevision: 0, action: { type: 'rest' } })).toThrow(EngineFault);
    expect(session.exportState()).toEqual(before);
  });
  it('advances forced no-command slots to the next real input boundary', () => {
    const state = createTwoRoomFixture(); state.timing.noCommand = 3;
    const session = new GameSession(state);
    const timing = session.exportState().timing;
    expect(timing.tick).toBe(3); expect(timing.noCommand).toBe(0);
    expect(timing.cycle).toEqual({ phase: 'input', slotsRemaining: 1 });
    expect(session.trace().filter(entry => entry.detail === 'forced-rest')).toHaveLength(3);
  });
  it('reports recovery when a submitted action starts forced turns', () => {
    const handler: ActionHandler = (_action, { state }) => {
      state.timing.noCommand = 2;
      return { resolved: true, consumedSlot: true, reason: null };
    };
    const session = new GameSession(createTwoRoomFixture(), { actionHandler: handler });
    const result = session.submit({ expectedRevision: 0, action: { type: 'rest' } });
    expect(result.ticksAdvanced).toBe(3);
    expect(result.events).toContainEqual({ type: 'message', text: 'You can move again.' });
  });
});
