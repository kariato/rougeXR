import { describe, expect, it } from 'vitest';
import { createKestrelEncounterFixture, createTwoRoomFixture } from '../../src/debug/fixtures';
import { allocateId } from '../../src/engine/entities';
import type { ItemState, WorldState } from '../../src/engine/model/state';
import { GameSession } from '../../src/engine/session';
import { ReplayRecorder, replay } from '../../src/persistence/replay';

function weapon(state: WorldState, definitionId: string, quantity: number, hitBonus = 0): string {
  const id=allocateId(state); const item:ItemState={kind:'item',id,definitionId,category:'weapon',location:{kind:'pack',owner:'player'},
    quantity,flags:0,group:quantity>1?7:0,label:null,hitBonus,damageBonus:0}; state.entities[id]=item; state.player.packOrder.push(id); return id;
}

describe('source-shaped thrown weapon trajectory',()=>{
  it('launches one arrow through open cells, hits a monster, and replays',async()=>{
    const initial=createKestrelEncounterFixture(301); const bowId=weapon(initial,'weapon.short-bow',1,3); const arrowId=weapon(initial,'weapon.arrow',2,50);
    initial.player.equipment.weapon=bowId; const before=(initial.entities.e1 as {stats:{hp:number}}).stats.hp;
    const session=new GameSession(initial); const recorder=new ReplayRecorder(session.exportState());
    session.submit({expectedRevision:0,action:{type:'throw',itemId:arrowId,direction:'E'}}); await recorder.record({type:'throw',itemId:arrowId,direction:'E'},0,session.exportState());
    const after=session.exportState(); expect((after.entities[arrowId] as ItemState).quantity).toBe(1);
    const monster=after.entities.e1; expect(monster === undefined || (monster.kind === 'monster' && monster.stats.hp < before)).toBe(true);
    expect(after.player.equipment.weapon).toBe(bowId);
    expect(await replay(recorder.bundle())).toEqual({ok:true,completed:1});
  });

  it('drops a missed throw near the impact cell and rejects cursed equipped weapons',()=>{
    const state=createTwoRoomFixture(302); const id=weapon(state,'weapon.mace',1); const session=new GameSession(state);
    session.submit({expectedRevision:0,action:{type:'throw',itemId:id,direction:'N'}}); const dropped=session.exportState().entities[id] as ItemState;
    expect(dropped.location.kind).toBe('floor');
    const cursed=session.exportState(); const cursedId=weapon(cursed,'weapon.spear',1); (cursed.entities[cursedId] as ItemState).flags|=1; cursed.player.equipment.weapon=cursedId;
    const cursedSession=new GameSession(cursed); expect(cursedSession.submit({expectedRevision:1,action:{type:'throw',itemId:cursedId,direction:'E'}}))
      .toMatchObject({status:'rejected',consumedSlot:false,reason:'cursed'});
  });
});
