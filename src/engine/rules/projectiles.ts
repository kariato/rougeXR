import { buildIndexes, splitStack, transferItem } from '../entities';
import { cellIndex, isPlayable, tileAt } from '../grid';
import type { RawEventInput } from '../model/action';
import type { Direction, EntityId, ItemState, Position, WorldState } from '../model/state';
import { rnd } from '../random';
import { IS_CURSED } from './flags';
import type { InventoryResult } from './inventory';
import { attackMonsterWithWeapon } from './combat';
import { canStepTerrain } from './movement';

const VECTORS: Record<Direction, Position> = { N:{x:0,y:-1},NE:{x:1,y:-1},E:{x:1,y:0},SE:{x:1,y:1},S:{x:0,y:1},SW:{x:-1,y:1},W:{x:-1,y:0},NW:{x:-1,y:-1} };
const HURLED: Record<string, { ordinary: [number, number]; launched?: [number, number]; launcher?: string }> = {
  'weapon.mace': { ordinary:[1,3] }, 'weapon.long-sword': { ordinary:[1,2] }, 'weapon.short-bow': { ordinary:[1,1] },
  'weapon.arrow': { ordinary:[1,1], launched:[2,3], launcher:'weapon.short-bow' }, 'weapon.dagger': { ordinary:[1,4] },
  'weapon.two-handed-sword': { ordinary:[1,2] }, 'weapon.dart': { ordinary:[1,3] }, 'weapon.shuriken': { ordinary:[2,4] },
  'weapon.spear': { ordinary:[1,6] },
};

export function throwItem(state: WorldState, itemId: EntityId, direction: Direction, emit: (event: RawEventInput) => void): InventoryResult {
  const carried = state.entities[itemId]; if (carried?.kind !== 'item' || carried.location.kind !== 'pack' || carried.location.owner !== 'player')
    return { resolved:false, consumedSlot:false, reason:'not-carried' };
  if (carried.category !== 'weapon' || !HURLED[carried.definitionId]) return { resolved:false, consumedSlot:false, reason:'not-throwable' };
  if (Object.values(state.player.equipment).includes(itemId) && (carried.flags & IS_CURSED) !== 0)
    return { resolved:false, consumedSlot:false, reason:'cursed' };
  const thrownId = carried.quantity > 1 ? splitStack(state, itemId) : itemId; const thrown = state.entities[thrownId] as Extract<ItemState,{category:'weapon'}>;
  if (state.player.equipment.weapon === thrownId) state.player.equipment.weapon = null;
  const packIndex = state.player.packOrder.indexOf(thrownId); state.player.packOrder.splice(packIndex, 1);
  const vector = VECTORS[direction]; const indexes = buildIndexes(state); let at = { ...state.player.at }; let monsterId: string | undefined;
  while (true) { at = { x:at.x+vector.x, y:at.y+vector.y }; if (!isPlayable(state.level, at)) break;
    monsterId = indexes.monsters.get(cellIndex(state.level, at)); if (monsterId) break;
    const terrain = tileAt(state.level, at).terrain; if (terrain === 'door' || !canStepTerrain(terrain)) break; }
  let hit = false; if (monsterId) { const data = HURLED[thrown.definitionId]!; const launcherId = state.player.equipment.weapon;
    const launcher = launcherId ? state.entities[launcherId] : null; const launched = data.launcher && launcher?.kind === 'item' && launcher.category === 'weapon' && launcher.definitionId === data.launcher;
    const dice = launched ? data.launched! : data.ordinary; hit = attackMonsterWithWeapon(state, monsterId, [{count:dice[0],sides:dice[1]}],
      thrown.hitBonus + (launched ? launcher.hitBonus : 0), thrown.damageBonus + (launched ? launcher.damageBonus : 0), emit); }
  if (hit) { delete state.entities[thrownId]; }
  else if (!fall(state, thrownId, at)) { delete state.entities[thrownId]; emit({type:'sourceMessage',text:'The weapon vanishes as it hits the ground.'}); }
  return { resolved:true, consumedSlot:true, reason:null };
}

function fall(state: WorldState, itemId: EntityId, impact: Position): boolean {
  const objects = buildIndexes(state).objects; let chosen: Position|null=null; let count=0;
  for(let y=impact.y-1;y<=impact.y+1;y++) for(let x=impact.x-1;x<=impact.x+1;x++){ const at={x,y};
    if ((x===state.player.at.x&&y===state.player.at.y)||!isPlayable(state.level,at)||objects.has(cellIndex(state.level,at))) continue;
    const terrain=tileAt(state.level,at).terrain; if(terrain!=='floor'&&terrain!=='passage') continue; if(rnd(state.rng,++count)===0) chosen=at; }
  if(!chosen)return false; const item=state.entities[itemId]; if(item?.kind!=='item')throw new Error('Thrown item missing');
  item.location={kind:'pack',owner:'player'}; state.player.packOrder.push(itemId); transferItem(state,itemId,{kind:'floor',levelId:state.level.id,at:chosen}); return true;
}
