import { describe, expect, it } from 'vitest';
import { cellIndex } from '../../src/engine/grid';
import { createNewGame } from '../../src/engine/new-game';
import { GameSession } from '../../src/engine/session';
import { validateWorld } from '../../src/engine/validate';
import { ReplayRecorder, parseReplay, replay } from '../../src/persistence/replay';

function sessionOnStairs(seed: number): GameSession {
  const state = createNewGame(seed); state.player.at = { ...state.level.stairs };
  state.player.roomId = state.level.tiles[cellIndex(state.level, state.player.at)]!.roomId; return new GameSession(state);
}

describe('generated level transition', () => {
  it('preserves player item identity and equipment while deleting old level entities (L01)', () => {
    const session = sessionOnStairs(501); const before = session.exportState(); const carried = [...before.player.packOrder];
    const oldLevelIds = [...before.level.monsterOrder, ...before.level.floorObjectOrder];
    const result = session.submit({ expectedRevision: 0, action: { type: 'descend' } }); const after = session.exportState();
    expect(result.events).toContainEqual({ type: 'levelViewReset' }); expect(after.level.depth).toBe(2);
    expect(after.player.packOrder).toEqual(carried); expect(after.player.equipment).toEqual(before.player.equipment);
    for (const id of carried) expect(after.entities[id]).toEqual(before.entities[id]);
    for (const id of oldLevelIds) expect(after.entities[id]).toBeUndefined();
    expect(after.nextEntitySerial).toBeGreaterThan(before.nextEntitySerial); expect(validateWorld(after)).toEqual([]);
  });
  it('rejects descent away from stairs without spending a slot', () => {
    const session = new GameSession(createNewGame(12)); const before = session.exportState();
    expect(session.submit({ expectedRevision: 0, action: { type: 'descend' } })).toMatchObject({ status: 'rejected', consumedSlot: false, reason: 'not-on-stairs' });
    expect(session.exportState().level).toEqual(before.level);
  });
  it('serializes and replays a level change exactly', async () => {
    const session = sessionOnStairs(8080); const recorder = new ReplayRecorder(session.exportState()); const action = { type: 'descend' } as const;
    session.submit({ expectedRevision: 0, action }); await recorder.record(action, 0, session.exportState());
    expect(parseReplay(JSON.stringify(recorder.bundle()))).toMatchObject({ ok: true }); expect(await replay(recorder.bundle())).toEqual({ ok: true, completed: 1 });
  });
});
