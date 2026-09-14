import type{ItemState,WorldState}from'../model/state';import{rnd}from'../random';import{extinguish}from'../scheduler';import{CAN_SEE_INVISIBLE,IS_RUNNING}from'./flags';
type Ring=Extract<ItemState,{category:'ring'}>;
export function applyRingEquip(state:WorldState,ring:Ring):void{if(ring.definitionId==='ring.add-strength')state.player.stats.strength=clamp(state.player.stats.strength+ring.magnitude);
 else if(ring.definitionId==='ring.see-invisible')state.player.flags|=CAN_SEE_INVISIBLE;else if(ring.definitionId==='ring.aggravate-monster')for(const id of state.level.monsterOrder){const monster=state.entities[id];if(monster?.kind==='monster'){monster.flags|=IS_RUNNING;monster.target={kind:'player'};}}}
export function applyRingRemove(state:WorldState,ring:Ring):void{if(ring.definitionId==='ring.add-strength')state.player.stats.strength=clamp(state.player.stats.strength-ring.magnitude);
 else if(ring.definitionId==='ring.see-invisible'){state.player.flags&=~CAN_SEE_INVISIBLE;extinguish(state.timing.scheduler,'unsee');}}
export function ringFoodCost(state:WorldState,slot:'leftRing'|'rightRing'):number{const id=state.player.equipment[slot];const ring=id?state.entities[id]:null;if(ring?.kind!=='item'||ring.category!=='ring')return 0;
 const fixed:Record<string,number>={'ring.protection':1,'ring.add-strength':1,'ring.sustain-strength':1,'ring.adornment':0,'ring.aggravate-monster':0,'ring.regeneration':2,'ring.teleportation':0,'ring.stealth':1,'ring.maintain-armor':1};if(ring.definitionId in fixed)return fixed[ring.definitionId]!;
 const chance:Record<string,number>={'ring.searching':3,'ring.see-invisible':5,'ring.dexterity':3,'ring.increase-damage':3,'ring.slow-digestion':2};const used=rnd(state.rng,chance[ring.definitionId]!)===0?1:0;return ring.definitionId==='ring.slow-digestion'?-used:used;}
export function ringCombatBonus(state:WorldState,kind:'hit'|'damage'|'armor'):number{return(['leftRing','rightRing']as const).reduce((sum,slot)=>{const id=state.player.equipment[slot];const ring=id?state.entities[id]:null;if(ring?.kind!=='item'||ring.category!=='ring')return sum;
 const match=kind==='hit'?'ring.dexterity':kind==='damage'?'ring.increase-damage':'ring.protection';return sum+(ring.definitionId===match?ring.magnitude:0);},0);}
function clamp(value:number):number{return Math.max(3,Math.min(31,value));}
