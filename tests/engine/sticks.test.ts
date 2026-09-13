import {describe,expect,it}from'vitest';
import{createKestrelEncounterFixture,createTwoRoomFixture}from'../../src/debug/fixtures';
import{allocateId}from'../../src/engine/entities';
import type{ItemState,WorldState}from'../../src/engine/model/state';
import{IS_HASTED,IS_INVISIBLE,IS_SLOWED}from'../../src/engine/rules/flags';
import{GameSession}from'../../src/engine/session';
import{ReplayRecorder,replay}from'../../src/persistence/replay';
import{restoreGame}from'../../src/persistence/save';

function stick(state:WorldState,definitionId:string,charges=4):string{const id=allocateId(state);state.entities[id]={kind:'item',id,definitionId,category:'stick',location:{kind:'pack',owner:'player'},quantity:1,flags:0,group:0,label:null,charges};state.player.packOrder.push(id);return id;}

describe('stick identities, charges, and first target effects',()=>{
 it('assigns 14 distinct wand or staff materials and exposes charges only when known',()=>{const state=createTwoRoomFixture(401);const entries=state.identification.filter(value=>value.definitionId.startsWith('stick.'));
  expect(entries).toHaveLength(14);expect(new Set(entries.map(value=>value.appearanceId)).size).toBe(14);const id=stick(state,'stick.light',12);
  const session=new GameSession(state);session.submit({expectedRevision:0,action:{type:'zap',itemId:id,direction:'E'}});const after=session.exportState();
  expect(after.identification.find(value=>value.definitionId==='stick.light')?.known).toBe(true);expect((after.entities[id]as ItemState)).toMatchObject({charges:11});
 });
 it('applies invisibility, haste/slow cancellation, cancellation, and empty-charge behavior',()=>{const state=createKestrelEncounterFixture(402);
  const ids=['stick.invisibility','stick.haste-monster','stick.slow-monster','stick.slow-monster','stick.cancellation'].map(value=>stick(state,value));const session=new GameSession(state);
  for(const id of ids){const revision=session.exportState().timing.revision;session.submit({expectedRevision:revision,action:{type:'zap',itemId:id,direction:'E'}});}
  const monster=session.exportState().entities.e1;if(monster?.kind!=='monster')throw new Error('missing monster');expect(monster.flags&IS_INVISIBLE).toBe(0);expect(monster.flags&IS_HASTED).toBe(0);expect(monster.flags&IS_SLOWED).not.toBe(0);
  const emptyState=session.exportState();const empty=stick(emptyState,'stick.nothing',0);const emptySession=new GameSession(emptyState);const result=emptySession.submit({expectedRevision:5,action:{type:'zap',itemId:empty,direction:'E'}});
  expect(result.events).toContainEqual({type:'message',text:'Nothing happens.'});expect((emptySession.exportState().entities[empty]as ItemState)).toMatchObject({charges:0});
 });
 it('fires a replayable magic missile and preserves charge state through restore',async()=>{const initial=createKestrelEncounterFixture(403);const id=stick(initial,'stick.magic-missile',3);const session=new GameSession(initial);const recorder=new ReplayRecorder(session.exportState());
  session.submit({expectedRevision:0,action:{type:'zap',itemId:id,direction:'E'}});await recorder.record({type:'zap',itemId:id,direction:'E'},0,session.exportState());const after=session.exportState();
  expect((after.entities[id]as ItemState)).toMatchObject({charges:2});expect(restoreGame(after).exportState()).toEqual(after);expect(await replay(recorder.bundle())).toEqual({ok:true,completed:1});
 });
 it('drains half the player HP across room monsters and does not charge when too weak',()=>{const state=createKestrelEncounterFixture(404);const id=stick(state,'stick.drain-life',2);const session=new GameSession(state);
  session.submit({expectedRevision:0,action:{type:'zap',itemId:id,direction:'E'}});const after=session.exportState();expect(after.player.stats.hp).toBe(5);expect(after.entities.e1).toBeUndefined();expect((after.entities[id]as ItemState)).toMatchObject({charges:1});
  after.player.stats.hp=1;const weakSession=new GameSession(after);weakSession.submit({expectedRevision:1,action:{type:'zap',itemId:id,direction:'E'}});expect((weakSession.exportState().entities[id]as ItemState)).toMatchObject({charges:1});
 });
 it('teleports a target adjacent to the player and then to a legal distant cell',()=>{const state=createKestrelEncounterFixture(405);const to=stick(state,'stick.teleport-to');const away=stick(state,'stick.teleport-away');const session=new GameSession(state);
  session.submit({expectedRevision:0,action:{type:'zap',itemId:to,direction:'E'}});let monster=session.exportState().entities.e1;if(monster?.kind!=='monster')throw new Error('missing monster');expect(monster.at).toEqual({x:6,y:5});
  session.submit({expectedRevision:1,action:{type:'zap',itemId:away,direction:'E'}});monster=session.exportState().entities.e1;if(monster?.kind!=='monster')throw new Error('missing monster');expect(monster.at).not.toEqual({x:6,y:5});expect(restoreGame(session.exportState()).exportState()).toEqual(session.exportState());
 });
 it('identifies and resolves each six-cell elemental bolt with saved charges',async()=>{for(const [index,effect]of['stick.lightning','stick.fire','stick.cold'].entries()){const initial=createKestrelEncounterFixture(410+index);const id=stick(initial,effect,2);const session=new GameSession(initial);const recorder=new ReplayRecorder(session.exportState());
   session.submit({expectedRevision:0,action:{type:'zap',itemId:id,direction:'E'}});await recorder.record({type:'zap',itemId:id,direction:'E'},0,session.exportState());const after=session.exportState();
   expect(after.identification.find(value=>value.definitionId===effect)?.known).toBe(true);expect((after.entities[id]as ItemState)).toMatchObject({charges:1});expect(await replay(recorder.bundle())).toEqual({ok:true,completed:1});}}
 );
});
