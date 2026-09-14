import { buildIndexes } from '../entities';
import { cellIndex, isPlayable, supportsOccupant, tileAt } from '../grid';
import type { RawEventInput } from '../model/action';
import type { Direction, EntityId, ItemState, Position, WorldState } from '../model/state';
import { rnd, roll } from '../random';
import { instantiateMonster, randomMonsterUniform } from '../generation/monsters';
import { attackMonsterWithWeapon, damageMonster } from './combat';
import { IS_CANCELLED, IS_CONFUSED, IS_HASTED, IS_INVISIBLE, IS_RUNNING, IS_SLOWED } from './flags';
import type { InventoryResult } from './inventory';
import { canStepTerrain } from './movement';

const VECTORS:Record<Direction,Position>={N:{x:0,y:-1},NE:{x:1,y:-1},E:{x:1,y:0},SE:{x:1,y:1},S:{x:0,y:1},SW:{x:-1,y:1},W:{x:-1,y:0},NW:{x:-1,y:-1}};
const SUPPORTED=new Set(['stick.light','stick.invisibility','stick.magic-missile','stick.haste-monster','stick.slow-monster','stick.nothing','stick.cancellation','stick.drain-life','stick.teleport-away','stick.teleport-to','stick.lightning','stick.fire','stick.cold','stick.polymorph']);

export function initializeStickCharges(state:WorldState,definitionId:string):number{return definitionId==='stick.light'?rnd(state.rng,10)+10:rnd(state.rng,5)+3;}

export function zapItem(state:WorldState,itemId:EntityId,direction:Direction,emit:(event:RawEventInput)=>void):InventoryResult{
  const item=state.entities[itemId]; if(item?.kind!=='item'||item.location.kind!=='pack'||item.location.owner!=='player')return{resolved:false,consumedSlot:false,reason:'not-carried'};
  if(item.category!=='stick'){message(emit,"You can't zap with that!");return{resolved:false,consumedSlot:false,reason:'not-a-stick'};}
  if(!SUPPORTED.has(item.definitionId))return{resolved:false,consumedSlot:false,reason:`unsupported-stick:${item.definitionId}`};
  if(item.charges===0){message(emit,'Nothing happens.');return{resolved:true,consumedSlot:true,reason:null};}
  if(item.definitionId==='stick.drain-life'&&state.player.stats.hp<2){message(emit,'You are too weak to use it.');return{resolved:true,consumedSlot:true,reason:null};}
  switch(item.definitionId){
    case'stick.light':light(state,item,emit);break;
    case'stick.magic-missile':missile(state,direction,emit);break;
    case'stick.nothing':break;case'stick.drain-life':drain(state,emit);break;
    case'stick.teleport-away':relocateTarget(state,direction,false);break;case'stick.teleport-to':relocateTarget(state,direction,true);break;
    case'stick.polymorph':polymorph(state,direction);break;
    case'stick.lightning':case'stick.fire':case'stick.cold':elementalBolt(state,direction,item.definitionId,emit);break;
    default:{const target=firstMonster(state,direction);if(target)affect(state,target,item.definitionId);break;}
  }
  item.charges--;emit({type:'itemChargesChanged',itemId,charges:item.charges});return{resolved:true,consumedSlot:true,reason:null};
}
function polymorph(state:WorldState,direction:Direction):void{const id=firstMonster(state,direction);const previous=id?state.entities[id]:null;if(previous?.kind!=='monster')return;
  const replacement=instantiateMonster(state.rng,state.level.depth,previous.id,randomMonsterUniform(state.rng),previous.at,previous.roomId);
  replacement.packOrder=[...previous.packOrder];replacement.flags|=previous.flags&IS_RUNNING;replacement.target=previous.target;state.entities[id!]=replacement;
}
function light(state:WorldState,item:Extract<ItemState,{category:'stick'}>,emit:(event:RawEventInput)=>void):void{
  learn(state,item.definitionId,emit);const room=state.player.roomId===null?null:state.level.rooms.find(value=>value.id===state.player.roomId);
  if(!room||room.kind==='gone')message(emit,'The corridor glows and then fades.');else{room.dark=false;message(emit,'The room is lit by a shimmering blue light.');}
}
function missile(state:WorldState,direction:Direction,emit:(event:RawEventInput)=>void):void{
  learn(state,'stick.magic-missile',emit);const id=firstMonster(state,direction);
  if(!id||roll(state.rng,1,20)>=17-Math.trunc((state.entities[id] as {stats:{level:number}}).stats.level/2)){message(emit,'The missile vanishes with a puff of smoke.');return;}
  attackMonsterWithWeapon(state,id,[{count:1,sides:4}],100,1,emit);
}
function affect(state:WorldState,id:EntityId,effect:string):void{const monster=state.entities[id];if(monster?.kind!=='monster')return;
  if(effect==='stick.invisibility')monster.flags|=IS_INVISIBLE;
  else if(effect==='stick.haste-monster'){if(monster.flags&IS_SLOWED)monster.flags&=~IS_SLOWED;else monster.flags|=IS_HASTED;}
  else if(effect==='stick.slow-monster'){if(monster.flags&IS_HASTED)monster.flags&=~IS_HASTED;else monster.flags|=IS_SLOWED;monster.slowTurn=true;}
  else if(effect==='stick.cancellation'){monster.flags|=IS_CANCELLED;monster.flags&=~(IS_INVISIBLE|IS_CONFUSED);monster.disguise=null;}
}
function drain(state:WorldState,emit:(event:RawEventInput)=>void):void{const ids=state.level.monsterOrder.filter(id=>{const monster=state.entities[id];if(monster?.kind!=='monster')return false;
  return state.player.roomId===null?Math.abs(monster.at.x-state.player.at.x)<=1&&Math.abs(monster.at.y-state.player.at.y)<=1:monster.roomId===state.player.roomId;});
  if(!ids.length){message(emit,'You have a tingling feeling.');return;}const before=state.player.stats.hp;state.player.stats.hp=Math.trunc(before/2);emit({type:'hpChanged',actorId:'player',from:before,to:state.player.stats.hp});
  const each=Math.trunc(state.player.stats.hp/ids.length);for(const id of ids)damageMonster(state,id,each,emit);
}
function relocateTarget(state:WorldState,direction:Direction,toPlayer:boolean):void{const id=firstMonster(state,direction);const monster=id?state.entities[id]:null;if(monster?.kind!=='monster')return;
  if(toPlayer){const vector=VECTORS[direction];monster.at={x:state.player.at.x+vector.x,y:state.player.at.y+vector.y};monster.roomId=state.level.tiles[cellIndex(state.level,monster.at)]!.roomId;}
  else{const indexes=buildIndexes(state);for(let tries=0;tries<10000;tries++){let room=state.level.rooms[rnd(state.rng,state.level.rooms.length)]!;while(room.kind==='gone')room=state.level.rooms[rnd(state.rng,state.level.rooms.length)]!;
    const at={x:room.origin.x+rnd(state.rng,room.width-2)+1,y:room.origin.y+rnd(state.rng,room.height-2)+1};const occupied=indexes.monsters.get(cellIndex(state.level,at));
    if(!supportsOccupant(state.level,at)||(occupied&&occupied!==id)||(at.x===state.player.at.x&&at.y===state.player.at.y))continue;monster.at=at;monster.roomId=state.level.tiles[cellIndex(state.level,at)]!.roomId;break;}}
  monster.flags|=IS_RUNNING;monster.target={kind:'player'};
}
function elementalBolt(state:WorldState,direction:Direction,effect:string,emit:(event:RawEventInput)=>void):void{learn(state,effect,emit);let vector={...VECTORS[direction]};let at={...state.player.at};let returning=false;let traveled=0;let bounces=0;
  while(traveled<6&&bounces<20){const next={x:at.x+vector.x,y:at.y+vector.y};if(!isPlayable(state.level,next)||!canStepTerrain(tileAt(state.level,next).terrain)||tileAt(state.level,next).terrain==='door'){
    vector={x:-vector.x,y:-vector.y};returning=!returning;bounces++;message(emit,`The ${effect.slice(6)} bounces.`);continue;}at=next;traveled++;
    const monsterId=buildIndexes(state).monsters.get(cellIndex(state.level,at));if(monsterId&&!returning){returning=true;const monster=state.entities[monsterId];if(monster?.kind==='monster'&&roll(state.rng,1,20)<17-Math.trunc(monster.stats.level/2)){damageMonster(state,monsterId,roll(state.rng,6,6),emit);return;}continue;}
    if(returning&&at.x===state.player.at.x&&at.y===state.player.at.y){if(roll(state.rng,1,20)<17-Math.trunc(state.player.stats.level/2)){const before=state.player.stats.hp;state.player.stats.hp=Math.max(0,before-roll(state.rng,6,6));emit({type:'hpChanged',actorId:'player',from:before,to:state.player.stats.hp});
      if(state.player.stats.hp===0){state.timing.status='dead';emit({type:'actorDefeated',actorId:'player',byActorId:'bolt'});}}return;}}
}
function firstMonster(state:WorldState,direction:Direction):EntityId|undefined{const vector=VECTORS[direction];const monsters=buildIndexes(state).monsters;let at={...state.player.at};
  while(true){at={x:at.x+vector.x,y:at.y+vector.y};if(!isPlayable(state.level,at))return;const id=monsters.get(cellIndex(state.level,at));if(id)return id;
    const terrain=tileAt(state.level,at).terrain;if(!canStepTerrain(terrain))return;}}
function learn(state:WorldState,definitionId:string,emit:(event:RawEventInput)=>void):void{const entry=state.identification.find(value=>value.definitionId===definitionId);if(!entry)throw new Error('Missing stick identity');
  if(!entry.known)emit({type:'identityLearned',definitionId});entry.known=true;entry.called=null;}
function message(emit:(event:RawEventInput)=>void,text:string):void{emit({type:'sourceMessage',text});}
