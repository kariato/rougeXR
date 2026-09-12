import { describe, expect, it } from 'vitest';
import { createTwoRoomFixture } from '../../src/debug/fixtures';
import type { GameAction } from '../../src/engine/model/action';
import { GameSession } from '../../src/engine/session';
import { ReplayPlayer } from '../../src/persistence/replay-player';
import { ReplayRecorder } from '../../src/persistence/replay';

async function recordedReplay() {
  const session = new GameSession(createTwoRoomFixture(91)); const recorder = new ReplayRecorder(session.exportState());
  for (const action of [{ type: 'rest' }, { type: 'search' }] as GameAction[]) {
    const revision = session.exportState().timing.revision; const result = session.submit({ expectedRevision: revision, action });
    await recorder.record(action, revision, session.exportState()); expect(result.revision).toBe(revision + 1);
  }
  return recorder.bundle();
}

describe('interactive replay player', () => {
  it('advances exactly one recorded action per step and restarts at the checkpoint', async () => {
    const player = new ReplayPlayer(await recordedReplay());
    expect(player.index()).toBe(0); expect(player.session().exportState().timing.revision).toBe(0);
    expect(await player.step()).toMatchObject({ status: 'advanced', index: 1, total: 2 });
    expect(player.session().exportState().timing.revision).toBe(1);
    expect(await player.step()).toMatchObject({ status: 'complete', index: 2, total: 2 });
    expect(player.canStep()).toBe(false);
    expect(player.restart().exportState().timing.revision).toBe(0); expect(player.index()).toBe(0);
  });

  it('locks at the first divergent action until restart', async () => {
    const bundle = await recordedReplay(); bundle.entries[0]!.expectedHash = '0'.repeat(64);
    const player = new ReplayPlayer(bundle);
    expect(await player.step()).toMatchObject({ status: 'diverged', index: 0, action: { type: 'rest' }, expectedHash: '0'.repeat(64), actualHash: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect(player.canStep()).toBe(false); await expect(player.step()).rejects.toThrow('no next action');
  });
});
