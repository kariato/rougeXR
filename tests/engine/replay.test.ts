import { describe, expect, it } from 'vitest';
import { createTwoRoomFixture } from '../../src/debug/fixtures';
import type { GameAction } from '../../src/engine/model/action';
import { GameSession } from '../../src/engine/session';
import { parseReplay, ReplayRecorder, replay, reproduceReplay } from '../../src/persistence/replay';

describe('basic replay', () => {
  it('rotates repeatedly by advancing the checkpoint before the retained suffix', async () => {
    const session = new GameSession(createTwoRoomFixture(33)); const recorder = new ReplayRecorder(session.exportState(), 3);
    for (let index = 0; index < 10; index++) {
      const action = { type: 'rest' } as const; const revision = session.exportState().timing.revision;
      session.submit({ expectedRevision: revision, action }); await recorder.record(action, revision, session.exportState());
      expect(recorder.bundle().entries.length).toBeLessThanOrEqual(3);
    }
    const retained = recorder.bundle();
    expect(retained.initial.state.timing.revision).toBe(7);
    expect(retained.entries.map(entry => entry.expectedRevision)).toEqual([7, 8, 9]);
    expect(await replay(retained)).toEqual({ ok: true, completed: 3 });
    expect((await reproduceReplay(retained)).state).toEqual(session.exportState());
  });

  it('reproduces rest, movement, search, and a rule rejection at every hash', async () => {
    const session = new GameSession(createTwoRoomFixture()); const recorder = new ReplayRecorder(session.exportState());
    const actions: GameAction[] = [
      { type: 'rest' }, { type: 'move', direction: 'E', pickup: true }, { type: 'search' },
      { type: 'fixture', name: 'unsupported' },
    ];
    for (const action of actions) {
      const revision = session.exportState().timing.revision;
      session.submit({ expectedRevision: revision, action });
      await recorder.record(action, revision, session.exportState());
    }
    const bundle = recorder.bundle();
    expect(bundle.entries).toHaveLength(4);
    expect(parseReplay(JSON.stringify(bundle))).toMatchObject({ ok: true });
    expect(await replay(bundle)).toEqual({ ok: true, completed: 4 });
    expect((await reproduceReplay(bundle)).state).toEqual(session.exportState());
    bundle.entries[2]!.expectedHash = 'wrong';
    expect(await replay(bundle)).toMatchObject({ ok: false, completed: 2, expectedHash: 'wrong' });
  });
});
