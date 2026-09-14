import { appearanceFor, updateKnowledge } from '../perception/knowledge';
import type { RawEventInput } from '../model/action';
import type { EntityId, ItemState, WorldState } from '../model/state';
import { rnd } from '../random';
import { allocateId, buildIndexes } from '../entities';
import { cellIndex, isPlayable, supportsOccupant, tileAt } from '../grid';
import { instantiateMonster, randomMonster } from '../generation/monsters';
import { CAN_CONFUSE_MONSTER, IS_CURSED, IS_HELD, IS_PROTECTED, IS_RUNNING } from './flags';
import type { InventoryResult } from './inventory';
import { canStepTerrain } from './movement';

const SUPPORTED = new Set(['scroll.monster-confusion', 'scroll.magic-mapping', 'scroll.hold-monster', 'scroll.sleep',
  'scroll.enchant-armor', 'scroll.scare-monster', 'scroll.food-detection', 'scroll.enchant-weapon',
  'scroll.remove-curse', 'scroll.aggravate-monsters', 'scroll.protect-armor', 'scroll.identify-potion', 'scroll.identify-scroll',
  'scroll.identify-weapon', 'scroll.identify-armor', 'scroll.identify-ring-stick']);
SUPPORTED.add('scroll.teleportation');
SUPPORTED.add('scroll.create-monster');

export function readItem(state: WorldState, itemId: EntityId, emit: (event: RawEventInput) => void): InventoryResult {
  const item = state.entities[itemId];
  if (item?.kind !== 'item' || item.location.kind !== 'pack' || item.location.owner !== 'player')
    return { resolved: false, consumedSlot: false, reason: 'not-carried' };
  if (item.category !== 'scroll') { emit({ type: 'sourceMessage', text: 'There is nothing on it to read.' });
    return { resolved: false, consumedSlot: false, reason: 'unreadable' }; }
  if (!SUPPORTED.has(item.definitionId)) return { resolved: false, consumedSlot: false, reason: `unsupported-scroll:${item.definitionId}` };
  const entry = state.identification.find(candidate => candidate.definitionId === item.definitionId);
  if (!entry) throw new Error(`Missing identification entry for ${item.definitionId}`);
  consumeOne(state, itemId); apply(state, item, entry, emit); emit({ type: 'itemConsumed', itemId, category: 'scroll' });
  if (!entry.known && entry.called === null) state.pendingDecision = { kind: 'callItem', definitionId: entry.definitionId };
  return { resolved: true, consumedSlot: true, reason: null };
}

function apply(state: WorldState, item: ItemState, entry: WorldState['identification'][number], emit: (event: RawEventInput) => void): void {
  switch (item.definitionId) {
    case 'scroll.monster-confusion': state.player.flags |= CAN_CONFUSE_MONSTER; message(emit, 'Your hands begin to glow red.'); break;
    case 'scroll.magic-mapping': magicMap(state); learn(entry, emit); message(emit, 'Oh, now this scroll has a map on it.'); break;
    case 'scroll.hold-monster': holdMonsters(state, entry, emit); break;
    case 'scroll.sleep': learn(entry, emit); state.timing.noCommand += rnd(state.rng, 5) + 4; state.player.flags &= ~IS_RUNNING; message(emit, 'You fall asleep.'); break;
    case 'scroll.enchant-armor': enchantArmor(state, emit); break;
    case 'scroll.scare-monster': message(emit, 'You hear maniacal laughter in the distance.'); break;
    case 'scroll.food-detection': detectFood(state, entry, emit); break;
    case 'scroll.enchant-weapon': enchantWeapon(state, emit); break;
    case 'scroll.remove-curse': removeCurse(state, emit); break;
    case 'scroll.aggravate-monsters': aggravate(state); message(emit, 'You hear a high pitched humming noise.'); break;
    case 'scroll.protect-armor': protectArmor(state, emit); break;
    case 'scroll.identify-potion': identifyDecision(state, entry, ['potion'], emit); break;
    case 'scroll.identify-scroll': identifyDecision(state, entry, ['scroll'], emit); break;
    case 'scroll.identify-weapon': identifyDecision(state, entry, ['weapon'], emit); break;
    case 'scroll.identify-armor': identifyDecision(state, entry, ['armor'], emit); break;
    case 'scroll.identify-ring-stick': identifyDecision(state, entry, ['ring', 'stick'], emit); break;
    case 'scroll.teleportation': teleportPlayer(state, entry, emit); break;
    case 'scroll.create-monster': createMonster(state, emit); break;
  }
}

function createMonster(state: WorldState, emit: (event: RawEventInput) => void): void {
  const indexes = buildIndexes(state); let selected: { x: number; y: number } | null = null; let count = 0;
  for (let y = state.player.at.y - 1; y <= state.player.at.y + 1; y++) for (let x = state.player.at.x - 1; x <= state.player.at.x + 1; x++) {
    const at = { x, y }; if ((x === state.player.at.x && y === state.player.at.y) || !isPlayable(state.level, at)
      || !canStepTerrain(tileAt(state.level, at).terrain) || indexes.monsters.has(cellIndex(state.level, at))
      || indexes.objects.has(cellIndex(state.level, at))) continue;
    if (rnd(state.rng, ++count) === 0) selected = at;
  }
  if (!selected) { message(emit, 'You hear a faint cry of anguish in the distance.'); return; }
  const id = allocateId(state); const definition = randomMonster(state.rng, state.level.depth, false);
  const roomId = state.level.tiles[cellIndex(state.level, selected)]!.roomId;
  state.entities[id] = instantiateMonster(state.rng, state.level.depth, id, definition, selected, roomId);
  state.level.monsterOrder.unshift(id);
}

function magicMap(state: WorldState): void {
  for (const tile of state.level.tiles) {
    if (tile.secret) { tile.secret = false; if (tile.terrain === 'wallH' || tile.terrain === 'wallV') tile.terrain = 'door'; }
    if (tile.feature?.kind === 'trap') tile.feature.revealed = true;
  }
  state.knowledge.remembered = state.level.tiles.map(tile => tile.terrain === 'void' ? null : appearanceFor(tile)); updateKnowledge(state);
}

function holdMonsters(state: WorldState, entry: WorldState['identification'][number], emit: (event: RawEventInput) => void): void {
  let held = 0; for (const id of state.level.monsterOrder) { const monster = state.entities[id];
    if (monster?.kind === 'monster' && Math.abs(monster.at.x - state.player.at.x) <= 2 && Math.abs(monster.at.y - state.player.at.y) <= 2
      && (monster.flags & IS_RUNNING) !== 0) { monster.flags = (monster.flags & ~IS_RUNNING) | IS_HELD; held++; } }
  if (held) { learn(entry, emit); message(emit, held === 1 ? 'The monster around you freezes.' : 'The monsters around you freeze.'); }
  else message(emit, 'You feel a strange sense of loss.');
}

function enchantArmor(state: WorldState, emit: (event: RawEventInput) => void): void {
  const armor = equipped(state, 'armor'); if (armor?.category !== 'armor') return message(emit, 'You feel a strange sense of loss.');
  armor.armorClass--; armor.flags &= ~IS_CURSED; message(emit, 'Your armor glows silver for a moment.');
}
function enchantWeapon(state: WorldState, emit: (event: RawEventInput) => void): void {
  const weapon = equipped(state, 'weapon'); if (weapon?.category !== 'weapon') return message(emit, 'You feel a strange sense of loss.');
  weapon.flags &= ~IS_CURSED; if (rnd(state.rng, 2) === 0) weapon.hitBonus++; else weapon.damageBonus++;
  message(emit, 'Your weapon glows blue for a moment.');
}
function removeCurse(state: WorldState, emit: (event: RawEventInput) => void): void {
  for (const id of Object.values(state.player.equipment)) { const item = id ? state.entities[id] : null; if (item?.kind === 'item') item.flags &= ~IS_CURSED; }
  message(emit, 'You feel as if somebody is watching over you.');
}
function aggravate(state: WorldState): void { for (const id of state.level.monsterOrder) { const monster = state.entities[id];
  if (monster?.kind === 'monster') { monster.flags |= IS_RUNNING; monster.target = { kind: 'player' }; } } }
function protectArmor(state: WorldState, emit: (event: RawEventInput) => void): void {
  const armor = equipped(state, 'armor'); if (armor?.category !== 'armor') return message(emit, 'You feel a strange sense of loss.');
  armor.flags |= IS_PROTECTED; message(emit, 'Your armor is covered by a shimmering gold shield.');
}
function detectFood(state: WorldState, entry: WorldState['identification'][number], emit: (event: RawEventInput) => void): void {
  const positions = Object.values(state.entities).flatMap(entity => entity.kind === 'item' && entity.category === 'food'
    && entity.location.kind === 'floor' ? [{ ...entity.location.at }] : []);
  if (positions.length) { learn(entry, emit); emit({ type: 'itemsDetected', glyph: ':', positions }); message(emit, 'Your nose tingles and you smell food.'); }
  else message(emit, 'Your nose tingles.');
}
function identifyDecision(state: WorldState, entry: WorldState['identification'][number], categories: ItemState['category'][], emit: (event: RawEventInput) => void): void {
  learn(entry, emit); message(emit, `This scroll is an ${entry.definitionId.slice(7).replaceAll('-', ' ')} scroll.`);
  if (state.player.packOrder.some(id => { const item = state.entities[id]; return item?.kind === 'item' && categories.includes(item.category); }))
    state.pendingDecision = { kind: 'identifyItem', categories };
}
export function teleportPlayer(state: WorldState, entry: WorldState['identification'][number] | null, emit: (event: RawEventInput) => void): void {
  const from = { ...state.player.at }; const fromRoom = state.player.roomId; const monsters = buildIndexes(state).monsters;
  for (let attempt = 0; attempt < 10000; attempt++) {
    let room = state.level.rooms[rnd(state.rng, state.level.rooms.length)]!; while (room.kind === 'gone') room = state.level.rooms[rnd(state.rng, state.level.rooms.length)]!;
    if (room.width <= 2 || room.height <= 2) continue;
    const at = { x: room.origin.x + rnd(state.rng, room.width - 2) + 1, y: room.origin.y + rnd(state.rng, room.height - 2) + 1 };
    if (!supportsOccupant(state.level, at) || monsters.has(cellIndex(state.level, at))) continue;
    state.player.at = at; state.player.roomId = state.level.tiles[cellIndex(state.level, at)]!.roomId;
    state.player.flags &= ~IS_HELD; state.timing.noMove = 0; state.player.flags &= ~IS_RUNNING;
    if (entry && state.player.roomId !== fromRoom) learn(entry, emit); emit({ type: 'actorMoved', actorId: 'player', from, to: { ...at } }); return;
  }
  throw new Error('Unable to find teleport destination');
}

export function answerIdentify(state: WorldState, itemId: EntityId, emit: (event: RawEventInput) => void): InventoryResult {
  const pending = state.pendingDecision; const item = state.entities[itemId];
  if (pending?.kind !== 'identifyItem') return { resolved: false, consumedSlot: false, reason: 'no-identify-decision' };
  if (item?.kind !== 'item' || item.location.kind !== 'pack' || item.location.owner !== 'player' || !pending.categories.includes(item.category))
    return { resolved: false, consumedSlot: false, reason: 'invalid-identify-item' };
  const entry = state.identification.find(value => value.definitionId === item.definitionId);
  if (entry) learn(entry, emit); item.flags |= 0o2; state.pendingDecision = null;
  message(emit, 'You identify the item.'); return { resolved: true, consumedSlot: false, reason: null };
}
function equipped(state: WorldState, slot: 'weapon' | 'armor'): ItemState | null { const id = state.player.equipment[slot];
  const item = id ? state.entities[id] : null; return item?.kind === 'item' ? item : null; }
function learn(entry: WorldState['identification'][number], emit: (event: RawEventInput) => void): void { if (!entry.known)
  emit({ type: 'identityLearned', definitionId: entry.definitionId }); entry.known = true; entry.called = null; }
function message(emit: (event: RawEventInput) => void, text: string): void { emit({ type: 'sourceMessage', text }); }
function consumeOne(state: WorldState, itemId: EntityId): void { const item = state.entities[itemId]; if (item?.kind !== 'item') throw new Error('Consumed scroll missing');
  if (--item.quantity > 0) return; const index = state.player.packOrder.indexOf(itemId); if (index < 0) throw new Error('Invalid scroll membership');
  state.player.packOrder.splice(index, 1); delete state.entities[itemId]; }
