import { describe, expect, it } from 'vitest';
import { createTwoRoomFixture } from '../../src/debug/fixtures';
import { cellIndex } from '../../src/engine/grid';
import { observe, updateKnowledge } from '../../src/engine/perception/knowledge';
import { CAN_DETECT_MONSTERS, IS_BLIND, IS_INVISIBLE } from '../../src/engine/rules/flags';
import { GameSession, type ActionHandler } from '../../src/engine/session';

describe('player knowledge', () => {
  it('remembers a lit room after entering a passage without exposing the next room', () => {
    const state = createTwoRoomFixture();
    state.player.at = { x: 12, y: 5 }; state.player.roomId = null; updateKnowledge(state);
    const view = observe(state);
    expect(view.cells[cellIndex(state.level, { x: 5, y: 5 })]?.visibility).toBe('remembered');
    expect(view.cells[cellIndex(state.level, { x: 12, y: 5 })]?.visibility).toBe('visible');
    expect(view.cells[cellIndex(state.level, { x: 23, y: 5 })]).toEqual({ visibility: 'unknown', appearance: null });
  });
  it('shows only the local neighborhood in a dark room and only the player cell while blind', () => {
    const state = createTwoRoomFixture(); state.level.rooms[0]!.dark = true;
    state.knowledge.remembered.fill(null); updateKnowledge(state);
    expect(observe(state).cells[cellIndex(state.level, { x: 6, y: 5 })]?.visibility).toBe('visible');
    expect(observe(state).cells[cellIndex(state.level, { x: 8, y: 5 })]?.visibility).toBe('unknown');
    state.player.flags |= IS_BLIND; state.knowledge.remembered.fill(null); updateKnowledge(state);
    expect(observe(state).cells[cellIndex(state.level, { x: 5, y: 5 })]?.visibility).toBe('visible');
    expect(observe(state).cells[cellIndex(state.level, { x: 6, y: 5 })]?.visibility).toBe('unknown');
  });
  it('projects disguises and detection without revealing definitions or unknown terrain', () => {
    const state = createTwoRoomFixture(); const monster = state.entities.e1!;
    if (monster.kind !== 'monster') throw new Error('fixture monster missing');
    monster.at = { x: 6, y: 5 }; monster.roomId = 0; monster.disguise = '$';
    let view = observe(state);
    expect(view.entities[0]).toMatchObject({ appearance: '$', label: '$' });
    monster.at = { x: 23, y: 5 }; monster.roomId = 1; monster.flags |= IS_INVISIBLE;
    state.player.flags |= CAN_DETECT_MONSTERS; view = observe(state);
    expect(view.entities[0]).toMatchObject({ appearance: '$', label: 'detected monster' });
    expect(view.entities[0]?.label).not.toContain('fixture.monster');
    expect(view.cells[cellIndex(state.level, monster.at)]).toEqual({ visibility: 'unknown', appearance: null });
  });
  it('keeps unseen actor movement in raw debug events only (P01)', () => {
    const handler: ActionHandler = (_action, { state, emitRaw }) => {
      const monster = state.entities.e1!; if (monster.kind !== 'monster') throw new Error('missing monster');
      const from = { ...monster.at }; monster.at = { x: 24, y: 5 };
      emitRaw({ type: 'actorMoved', actorId: monster.id, from, to: { ...monster.at } });
      return { resolved: true, consumedSlot: false, reason: null };
    };
    const session = new GameSession(createTwoRoomFixture(), { actionHandler: handler });
    const result = session.submit({ expectedRevision: 0, action: { type: 'fixture', name: 'hidden-move' } });
    expect(result.events).toEqual([]);
    expect(session.debugEvents()).toEqual([{ type: 'actorMoved', actorId: 'e1', from: { x: 23, y: 5 },
      to: { x: 24, y: 5 }, ordinal: 0, actionSequence: 1 }]);
  });
});
