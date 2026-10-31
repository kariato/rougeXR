import { describe, expect, it } from 'vitest';
import { createTwoRoomFixture } from '../../src/debug/fixtures';
import { createNewGame } from '../../src/engine/new-game';
import type { Difficulty } from '../../src/engine/model/state';
import { attackPlayer } from '../../src/engine/rules/combat';
import { runStomach } from '../../src/engine/rules/hunger';
import { triggerTrap } from '../../src/engine/rules/traps';
import { cellIndex } from '../../src/engine/grid';
import { GameSession } from '../../src/engine/session';
import { parseSave, serializeSave } from '../../src/persistence/save';
import { parseReplay, ReplayRecorder, replay } from '../../src/persistence/replay';
import { validateWorld } from '../../src/engine/validate';
import { observe } from '../../src/engine/perception/knowledge';

function encounter(difficulty: Difficulty = 'normal', godMode = false) {
  const state = createTwoRoomFixture(32);
  state.settings = { difficulty, godMode };
  const monster = state.entities.e1;
  if (monster?.kind !== 'monster') throw new Error('missing monster');
  monster.stats.level = 100; monster.stats.strength = 16;
  monster.stats.damage = [{ count: 1, sides: 6 }];
  state.player.stats.hp = state.player.stats.maxHp = 100;
  return { state, monster };
}

describe('difficulty and debug god mode', () => {
  it('preserves the generated dungeon and random draws when selecting difficulty', () => {
    const normal = createNewGame(123);
    const easy = createNewGame(123, 'easy');
    expect(easy.settings).toEqual({ difficulty: 'easy', godMode: false });
    delete easy.settings;
    expect(easy).toEqual(normal);
  });

  it('scales monster damage once and leaves random draws unchanged', () => {
    const damage = (difficulty: Difficulty, godMode = false) => {
      const { state, monster } = encounter(difficulty, godMode);
      attackPlayer(state, monster, () => {});
      return { lost: 100 - state.player.stats.hp, draws: state.rng.draws };
    };
    const normal = damage('normal');
    expect(normal.lost).toBeGreaterThan(0);
    expect(damage('easy')).toEqual({ lost: Math.ceil(normal.lost / 2), draws: normal.draws });
    expect(damage('hard')).toEqual({ lost: Math.ceil(normal.lost * 1.5), draws: normal.draws });
    expect(damage('hard', true)).toEqual({ lost: 0, draws: normal.draws });
  });

  it('prevents fatal arrow traps while still revealing them', () => {
    const { state } = encounter('hard', true);
    state.player.stats.hp = 1;
    state.player.stats.armorClass = 100; // force the trap hit
    const tile = state.level.tiles[cellIndex(state.level, state.player.at)]!;
    tile.feature = { kind: 'trap', trap: 'arrow', revealed: false };
    triggerTrap(state, state.player.at, () => {});
    expect(tile.feature.revealed).toBe(true);
    expect(state.player.stats.hp).toBe(1);
    expect(state.timing.status).toBe('playing');
  });

  it('protects against energy drain and maximum HP loss', () => {
    for (const definitionId of ['monster.wraith', 'monster.vampire']) {
      const { state, monster } = encounter('normal', true);
      monster.definitionId = definitionId;
      state.player.stats.hp = state.player.stats.maxHp = 1;
      for (let i = 0; i < 100; i++) attackPlayer(state, monster, () => {});
      expect(state.player.stats.hp).toBe(1);
      expect(state.player.stats.maxHp).toBe(1);
      expect(state.timing.status).toBe('playing');
    }
  });

  it('changes hunger pace and prevents starvation in god mode', () => {
    for (const [difficulty, cost] of [['easy', 1], ['normal', 2], ['hard', 4]] as const) {
      const { state } = encounter(difficulty);
      const before = state.timing.foodLeft;
      for (const tick of [2, 3]) { state.timing.tick = tick; runStomach(state, () => {}); }
      expect(before - state.timing.foodLeft).toBe(cost);
    }
    const { state } = encounter('hard', true);
    state.timing.foodLeft = -900;
    runStomach(state, () => {});
    expect(state.timing.status).toBe('playing');
    expect(state.timing.noCommand).toBe(0);
  });

  it('saves and replays toggles without advancing time', async () => {
    const session = new GameSession(createTwoRoomFixture(32));
    const recorder = new ReplayRecorder(session.exportState());
    for (const enabled of [true, false, true]) {
      const revision = session.exportState().timing.revision;
      const action = { type: 'setGodMode', enabled } as const;
      const resolution = session.submit({ expectedRevision: revision, action });
      expect(resolution.ticksAdvanced).toBe(0);
      expect(resolution.consumedSlot).toBe(false);
      await recorder.record(action, revision, session.exportState());
    }
    expect(observe(session.exportState()).status.godMode).toBe(true);
    const save = parseSave(serializeSave(session.exportState()));
    expect(save.ok && save.value.state.settings?.godMode).toBe(true);
    const parsed = parseReplay(JSON.stringify(recorder.bundle()));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error(parsed.error);
    expect(await replay(parsed.value)).toEqual({ ok: true, completed: 3 });
    const legacy = new GameSession(createTwoRoomFixture()).exportState();
    expect(parseSave(serializeSave(legacy)).ok).toBe(true);
    expect(legacy.settings).toBeUndefined();
  });

  it('rejects malformed settings and toggles', () => {
    const { state } = encounter();
    (state.settings as any).difficulty = 'extreme';
    expect(validateWorld(state).some(issue => issue.path === 'settings')).toBe(true);
    const session = new GameSession(createTwoRoomFixture());
    expect(() => session.submit({ expectedRevision: 0, action: { type: 'setGodMode', enabled: 'yes' } as any })).toThrow('Malformed');
  });
});
