import { describe, expect, it } from 'vitest';
import { parseDamage, STRENGTH_DAMAGE_BONUS, STRENGTH_HIT_BONUS } from '../../src/definitions/combat';
import { createKestrelEncounterFixture, createTwoRoomFixture } from '../../src/debug/fixtures';
import { allocateId, transferItem } from '../../src/engine/entities';
import { attackMonster, attackPlayer, wakeRoomMonsters } from '../../src/engine/rules/combat';
import { CAN_CONFUSE_MONSTER, IS_CONFUSED, IS_HELD, IS_LEVITATING, IS_MEAN, IS_RUNNING } from '../../src/engine/rules/flags';
import { GameSession } from '../../src/engine/session';
import { ReplayRecorder, replay } from '../../src/persistence/replay';

describe('source combat encounter', () => {
  it('wakes mean monsters when the player enters their room', () => {
    const state = createTwoRoomFixture();
    const monster = state.entities.e1;
    if (monster?.kind !== 'monster') throw new Error('missing monster');
    monster.roomId = state.player.roomId; monster.flags = IS_MEAN; monster.target = null;
    for (let attempt = 0; attempt < 10 && (monster.flags & IS_RUNNING) === 0; attempt++) wakeRoomMonsters(state);
    expect(monster.flags & IS_RUNNING).toBe(IS_RUNNING);
    expect(monster.target).toEqual({ kind: 'player' });
  });

  it('keeps mean monsters asleep while stealthy or levitating', () => {
    for (const protection of ['ring.stealth', 'levitation'] as const) {
      const state = createTwoRoomFixture(31); const monster = state.entities.e1; if (monster?.kind !== 'monster') throw new Error('missing monster');
      monster.roomId = state.player.roomId; monster.flags = IS_MEAN; const draws = state.rng.draws;
      if (protection === 'levitation') state.player.flags |= IS_LEVITATING;
      else { const id = allocateId(state); state.entities[id] = { kind: 'item', id, definitionId: protection, category: 'ring',
        location: { kind: 'pack', owner: 'player' }, quantity: 1, flags: 0, group: 0, label: null, magnitude: 1 };
        state.player.packOrder.push(id); state.player.equipment.leftRing = id; }
      wakeRoomMonsters(state); expect(monster.flags & IS_RUNNING).toBe(0); expect(state.rng.draws).toBe(draws);
    }
  });

  it('applies source ice, rust, and leprechaun hit effects', () => {
    const frozen = createTwoRoomFixture(32); const ice = frozen.entities.e1; if (ice?.kind !== 'monster') throw new Error('missing monster');
    ice.definitionId = 'monster.ice-monster'; ice.stats.level = 30; ice.stats.damage = [{ count: 0, sides: 0 }];
    attackPlayer(frozen, ice, () => {}); expect(frozen.timing.noCommand).toBeGreaterThanOrEqual(2);

    const rusted = createTwoRoomFixture(33); const aquator = rusted.entities.e1; if (aquator?.kind !== 'monster') throw new Error('missing monster');
    const armorId = allocateId(rusted); rusted.entities[armorId] = { kind: 'item', id: armorId, definitionId: 'armor.chain', category: 'armor',
      location: { kind: 'pack', owner: 'player' }, quantity: 1, flags: 0, group: 0, label: null, armorClass: 5 };
    rusted.player.packOrder.push(armorId); rusted.player.equipment.armor = armorId; aquator.definitionId = 'monster.aquator'; aquator.stats.level = 30; aquator.stats.damage = [{ count: 0, sides: 0 }];
    attackPlayer(rusted, aquator, () => {}); expect(rusted.entities[armorId]).toMatchObject({ armorClass: 6 });

    const robbed = createTwoRoomFixture(34); const leprechaun = robbed.entities.e1; if (leprechaun?.kind !== 'monster') throw new Error('missing monster');
    robbed.player.gold = 500; leprechaun.definitionId = 'monster.leprechaun'; leprechaun.stats.level = 30;
    attackPlayer(robbed, leprechaun, () => {}); expect(robbed.player.gold).toBeLessThan(500); expect(robbed.entities.e1).toBeUndefined();
  });

  it('tracks flytrap constriction and lets nymphs steal unequipped magic', () => {
    const trapped = createTwoRoomFixture(35); const flytrap = trapped.entities.e1; if (flytrap?.kind !== 'monster') throw new Error('missing monster');
    flytrap.definitionId = 'monster.venus-flytrap'; flytrap.stats.level = 30; flytrap.stats.damage = [{ count: 0, sides: 0 }]; const hp = trapped.player.stats.hp;
    attackPlayer(trapped, flytrap, () => {}); expect(trapped.player.flags & IS_HELD).toBe(IS_HELD);
    expect(trapped.sourceState.flytrapHits).toBe(1); expect(trapped.player.stats.hp).toBe(hp - 1);

    const stolen = createTwoRoomFixture(36); const nymph = stolen.entities.e1; if (nymph?.kind !== 'monster') throw new Error('missing monster');
    const potionId = allocateId(stolen); stolen.entities[potionId] = { kind: 'item', id: potionId, definitionId: 'potion.healing', category: 'potion',
      location: { kind: 'pack', owner: 'player' }, quantity: 1, flags: 0, group: 0, label: null }; stolen.player.packOrder.push(potionId);
    nymph.definitionId = 'monster.nymph'; nymph.stats.level = 30; nymph.stats.damage = [{ count: 0, sides: 0 }]; attackPlayer(stolen, nymph, () => {});
    expect(stolen.entities[potionId]).toBeUndefined(); expect(stolen.entities.e1).toBeUndefined();
  });

  it('applies a visible Medusa gaze once when she wakes', () => {
    let confused = false;
    for (let seed = 1; seed <= 100 && !confused; seed++) { const state = createTwoRoomFixture(seed); const medusa = state.entities.e1;
      if (medusa?.kind !== 'monster') throw new Error('missing monster'); medusa.definitionId = 'monster.medusa'; medusa.roomId = state.player.roomId; medusa.flags = IS_MEAN;
      wakeRoomMonsters(state); confused = (state.player.flags & IS_CONFUSED) !== 0;
      if (confused) expect(state.timing.scheduler.slots).toContainEqual(expect.objectContaining({ effect: 'unconfuse', phase: 'after' }));
    }
    expect(confused).toBe(true);
  });

  it('reveals a disguised Xeroc before melee and transfers a confusion charge on a later hit', () => {
    const state = createKestrelEncounterFixture(37); const xeroc = state.entities.e1; if (xeroc?.kind !== 'monster') throw new Error('missing monster');
    xeroc.definitionId = 'monster.xeroc'; xeroc.disguise = '!'; xeroc.stats.hp = xeroc.stats.maxHp = 20; state.player.stats.level = 30;
    state.player.stats.damage = [{ count: 0, sides: 0 }]; state.player.flags |= CAN_CONFUSE_MONSTER;
    const hp = xeroc.stats.hp; attackMonster(state, xeroc.id, () => {}); expect(xeroc.disguise).toBe('X'); expect(xeroc.stats.hp).toBe(hp);
    expect(state.player.flags & CAN_CONFUSE_MONSTER).toBe(CAN_CONFUSE_MONSTER);
    attackMonster(state, xeroc.id, () => {}); expect(xeroc.flags & IS_CONFUSED).toBe(IS_CONFUSED); expect(state.player.flags & CAN_CONFUSE_MONSTER).toBe(0);
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
