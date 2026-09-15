import { describe, expect, it } from 'vitest';
import { createKestrelEncounterFixture, createTwoRoomFixture } from '../../src/debug/fixtures';
import { IS_INVISIBLE } from '../../src/engine/rules/flags';
import { GameSession } from '../../src/engine/session';

describe('visible combat cues', () => {
  const encounter = (x: number, invisible = false) => {
    const state = createTwoRoomFixture(2701);
    const monster = state.entities.e1;
    if (monster?.kind !== 'monster') throw new Error('Missing fixture monster');
    monster.at = { x, y: 5 };monster.roomId = x < 12 ? 0 : 1;
    if (invisible) monster.flags |= IS_INVISIBLE;
    const session = new GameSession(state, { actionHandler: (_action, { emitRaw }) => {
      emitRaw({ type: 'attackResolved', attackerId: 'player', defenderId: 'e1', groupIndex: 0, roll: 17, hit: true, damage: 2 });
      emitRaw({ type: 'actorDefeated', actorId: 'e1', byActorId: 'player' });
      return { resolved: true, consumedSlot: false, reason: null };
    } });
    return session.submit({ expectedRevision: 0, action: { type: 'rest' } }).events;
  };

  it('provides positions and defeat timing for a disclosed opponent', () => {
    const events = encounter(6);
    expect(events).toContainEqual({ type: 'visibleAttack', attackerToken: 'player', defenderToken: 'monster-e1',
      attackerAt: { x: 5, y: 5 }, defenderAt: { x: 6, y: 5 }, hit: true });
    expect(events).toContainEqual(expect.objectContaining({ type: 'visibleDefeat', token: 'monster-e1', at: { x: 6, y: 5 }, appearance: expect.any(String), label: expect.any(String) }));
  });

  it('does not expose a hidden or invisible opponent through animation cues', () => {
    for (const events of [encounter(23), encounter(6, true)]) {
      expect(events.some(event => event.type === 'visibleAttack' || event.type === 'visibleDefeat')).toBe(false);
    }
  });
  it('emits a player gesture only for a resolved non-movement action', () => {
    const session=new GameSession(createTwoRoomFixture(2702));
    const result=session.submit({expectedRevision:0,action:{type:'search'}});
    expect(result.events).toContainEqual({type:'visiblePlayerAction',action:'search'});
    const rejected=new GameSession(createTwoRoomFixture(2704),{actionHandler:()=>({resolved:false,consumedSlot:false,reason:'blocked'})});
    expect(rejected.submit({expectedRevision:0,action:{type:'search'}}).events.some(event=>event.type==='visiblePlayerAction')).toBe(false);
  });
  it('keeps a disclosed magical defeat location after the monster is removed', () => {
    const state=createTwoRoomFixture(2703);const monster=state.entities.e1;
    if (monster?.kind!=='monster') throw new Error('Missing fixture monster');
    monster.at={x:6,y:5};monster.roomId=0;
    const session=new GameSession(state,{actionHandler:(_action,{state:draft,emitRaw})=>{
      emitRaw({type:'hpChanged',actorId:'e1',from:3,to:0});delete draft.entities.e1;draft.level.monsterOrder.splice(draft.level.monsterOrder.indexOf('e1'),1);
      emitRaw({type:'actorDefeated',actorId:'e1',byActorId:'player'});return {resolved:true,consumedSlot:false,reason:null};
    }});
    const events=session.submit({expectedRevision:0,action:{type:'rest'}}).events;
    expect(events).toContainEqual(expect.objectContaining({type:'visibleDefeat',token:'monster-e1',at:{x:6,y:5},appearance:expect.any(String),label:expect.any(String)}));
  });
  it('emits a visible defeat for a real Kestrel kill', () => {
    const session = new GameSession(createKestrelEncounterFixture(12345));
    let defeat = null as Extract<ReturnType<GameSession['submit']>['events'][number], { type: 'visibleDefeat' }> | null;
    for (let revision = 0; revision < 12 && !defeat; revision++) {
      const result = session.submit({ expectedRevision: revision, action: { type: 'move', direction: 'E', pickup: true } });
      defeat = result.events.find(event => event.type === 'visibleDefeat' && event.token !== 'player') as typeof defeat;
    }
    expect(defeat).toEqual(expect.objectContaining({ token: 'monster-e1', appearance: 'K' }));
  });
});
