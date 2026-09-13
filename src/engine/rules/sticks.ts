import { buildIndexes } from '../entities';
import { cellIndex, isPlayable, tileAt } from '../grid';
import type { RawEventInput } from '../model/action';
import type { Direction, EntityId, ItemState, Position, WorldState } from '../model/state';
import { rnd, roll } from '../random';
import { attackMonsterWithWeapon } from './combat';
import { IS_CANCELLED, IS_CONFUSED, IS_HASTED, IS_INVISIBLE, IS_SLOWED } from './flags';
import type { InventoryResult } from './inventory';
import { canStepTerrain } from './movement';

const VECTORS:Record<Direction,Position>={N:{x:0,y:-1},NE:{x:1,y:-1},E:{x:1,y:0},SE:{x:1,y:1},S:{x:0,y:1},SW:{x:-1,y:1},W:{x:-1,y:0},NW:{x:-1,y:-1}};
const SUPPORTED=new Set(['stick.light','stick.invisibility','stick.magic-missile','stick.haste-monster','stick.slow-monster','stick.nothing','stick.cancellation']);

export function initializeStickCharges(state:WorldState,definitionId:string):number{return definitionId==='stick.light'?rnd(state.rng,10)+10:rnd(state.rng,5)+3;}

export function zapItem(state:WorldState,itemId:EntityId,direction:Direction,emit:(event:RawEventInput)=>void):InventoryResult{
  const item=state.entities[itemId]; if(item?.kind!=='item'||item.location.kind!=='pack'||item.location.owner!=='player')return{resolved:false,consumedSlot:false,reason:'not-carried'};
  if(item.category!=='stick'){message(emit,"You can't zap with that!");return{resolved:false,consumedSlot:false,reason:'not-a-stick'};}
  if(!SUPPORTED.has(item.definitionId))return{resolved:false,consumedSlot:false,reason:`unsupported-stick:${item.definitionId}`};
  if(item.charges===0){message(emit,'Nothing happens.');return{resolved:true,consumedSlot:true,reason:null};}
  switch(item.definitionId){
    case'stick.light':light(state,item,emit);break;
    case'stick.magic-missile':missile(state,direction,emit);break;
    case'stick.nothing':break;
    default:{const target=firstMonster(state,direction);if(target)affect(state,target,item.definitionId);break;}
  }
  item.charges--;emit({type:'itemChargesChanged',itemId,charges:item.charges});return{resolved:true,consumedSlot:true,reason:null};
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
function firstMonster(state:WorldState,direction:Direction):EntityId|undefined{const vector=VECTORS[direction];const monsters=buildIndexes(state).monsters;let at={...state.player.at};
  while(true){at={x:at.x+vector.x,y:at.y+vector.y};if(!isPlayable(state.level,at))return;const id=monsters.get(cellIndex(state.level,at));if(id)return id;
    const terrain=tileAt(state.level,at).terrain;if(!canStepTerrain(terrain))return;}}
function learn(state:WorldState,definitionId:string,emit:(event:RawEventInput)=>void):void{const entry=state.identification.find(value=>value.definitionId===definitionId);if(!entry)throw new Error('Missing stick identity');
  if(!entry.known)emit({type:'identityLearned',definitionId});entry.known=true;entry.called=null;}
function message(emit:(event:RawEventInput)=>void,text:string):void{emit({type:'sourceMessage',text});}
