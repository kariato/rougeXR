import { describe, expect, it } from 'vitest';
import { parseDamage, STRENGTH_DAMAGE_BONUS, STRENGTH_HIT_BONUS } from '../../src/definitions/combat';
import { createKestrelEncounterFixture, createTwoRoomFixture } from '../../src/debug/fixtures';
import { transferItem } from '../../src/engine/entities';
import { attackMonster, wakeRoomMonsters } from '../../src/engine/rules/combat';
import { IS_MEAN, IS_RUNNING } from '../../src/engine/rules/flags';
import { GameSession } from '../../src/engine/session';
import { ReplayRecorder, replay } from '../../src/persistence/replay';

describe('source combat encounter', () => {
  it('wakes mean monsters when the player enters their room', () => {
    const state = createTwoRoomFixture();
    const monster = state.entities.e1;
    if (monster?.kind !== 'monster') throw new Error('missing monster');
    monster.roomId = state.player.roomId; monster.flags = IS_MEAN; monster.target = null;
    wakeRoomMonsters(state);
    expect(monster.flags & IS_RUNNING).toBe(IS_RUNNING);
    expect(monster.target).toEqual({ kind: 'player' });
  });

  it('transcribes strength tables and parses every damage group', () => {
    expect(STRENGTH_HIT_BONUS).toHaveLength(32); expect(STRENGTH_DAMAGE_BONUS).toHaveLength(32);
    expect(parseDamage('1x6/2x4/0x0')).toEqual([{ count: 1, sides: 6 }, { count: 2, sides: 4 }, { count: 0, sides: 0 }]);
    expect(() => parseDamage('1d6')).toThrow(/Malformed/);
  });

  it('uses bump combat without moving the player and runs pursuit AFTER', () => {
    const session = new GameSession(createKestrelEncounterFixture(9));
    session.submit({ expectedRevision: 0, action: { type: 'move', direction: 'E', pickup: true } });
    const afterFirst = session.exportState();
    expect(afterFirst.player.at).toEqual({ x: 6, y: 5 }); expect(afterFirst.entities.e1).toMatchObject({ at: { x: 7, y: 5 } });
    const result = session.submit({ expectedRevision: 1, action: { type: 'move', direction: 'E', pickup: true } });
    expect(session.exportState().player.at).toEqual({ x: 6, y: 5 });
    expect(result.consumedSlot).toBe(true); expect(session.debugEvents().some(event => event.type === 'attackResolved')).toBe(true);
  });

  it('releases a carried item with the same identity when a monster dies', () => {
    const state = createKestrelEncounterFixture(1); const monster = state.entities.e1;
    if (monster?.kind !== 'monster') throw new Error('missing monster');
    transferItem(state, 'e2', { kind: 'pack', owner: monster.id });
    monster.stats.hp = 1; monster.stats.maxHp = 1; monster.flags = 0;
    state.player.stats.level = 20; state.player.stats.strength = 31;
    attackMonster(state, monster.id, () => {});
    expect(state.entities.e1).toBeUndefined();
    expect(state.entities.e2).toMatchObject({ id: 'e2', location: { kind: 'floor' } });
    expect(state.level.floorObjectOrder).toEqual(['e2']);
  });

  it('replays a complete encounter with identical hashes', async () => {
    const session = new GameSession(createKestrelEncounterFixture(12345)); const recorder = new ReplayRecorder(session.exportState());
    const actions = [{ type: 'move', direction: 'E', pickup: true }, ...Array.from({ length: 30 }, () => ({ type: 'move', direction: 'E', pickup: true } as const))] as const;
    for (const action of actions) {
      if (session.exportState().timing.status !== 'playing') break;
      const revision = session.exportState().timing.revision; session.submit({ expectedRevision: revision, action });
      await recorder.record(action, revision, session.exportState());
    }
    expect(session.exportState().timing.status === 'dead' || session.exportState().entities.e1 === undefined).toBe(true);
    expect(await replay(recorder.bundle())).toEqual({ ok: true, completed: recorder.bundle().entries.length });
  });
});
