import { KESTREL } from '../../definitions/combat';
import { GRID_HEIGHT, GRID_WIDTH, cellIndex } from '../grid';
import type { EntityId, EntityState, LevelState, Position, RandomState, RoomState, TrapKind } from '../model/state';
import { createRandom, rnd, roll } from '../random';
import { ACTIVE_TRAPS } from '../rules/traps';
import { buildPassages } from './passages';
import { buildRooms } from './rooms';

export interface GeneratedLevelContent {
  profile: 'supported-slice'; rng: RandomState; nextEntitySerial: number;
  level: LevelState; entities: Record<EntityId, EntityState>; playerAt: Position; playerRoomId: number | null;
}

export function generateLevelContent(seed: number, depth: number): GeneratedLevelContent {
  return generateLevelContentFromRandom(createRandom(seed), depth);
}

export function generateLevelContentFromRandom(rng: RandomState, depth: number, firstEntitySerial = 1): GeneratedLevelContent {
  const layout = buildPassages(rng, depth, buildRooms(rng, depth));
  const entities: Record<EntityId, EntityState> = {}; const monsterOrder: EntityId[] = []; const floorObjectOrder: EntityId[] = [];
  let serial = firstEntitySerial; const allocate = (): EntityId => `e${serial++}`;
  const occupiedObjects = new Set<number>(); const occupiedMonsters = new Set<number>();
  const floorRooms = layout.rooms.filter(room => room.kind !== 'gone');
  for (const room of floorRooms) {
    let gold = false;
    if (rnd(rng, 2) === 0) {
      const at = findFloor(rng, layout.rooms, layout.tiles, occupiedObjects, occupiedMonsters, room); const id = allocate(); const quantity = rnd(rng, 50 + 10 * depth) + 2;
      entities[id] = { kind: 'item', id, definitionId: 'gold.pieces', category: 'gold', location: { kind: 'floor', levelId: depth, at }, quantity, flags: 0, group: 1, label: null };
      floorObjectOrder.unshift(id); occupiedObjects.add(index(at)); room.goldTarget = { ...at }; gold = true;
    }
    if (rnd(rng, 100) < (gold ? 80 : 25)) {
      rnd(rng, 100); // source randmonster selection draw; supported slice maps the result to Kestrel
      const at = findFloor(rng, layout.rooms, layout.tiles, occupiedObjects, occupiedMonsters, room); const id = allocate(); const hp = roll(rng, KESTREL.stats.level, 8);
      entities[id] = { kind: 'monster', id, definitionId: KESTREL.id, at, stats: { ...KESTREL.stats, hp, maxHp: hp, damage: KESTREL.stats.damage.map(group => ({ ...group })) },
        flags: KESTREL.flags, slowTurn: true, target: null, disguise: KESTREL.glyph, roomId: room.id, packOrder: [] };
      monsterOrder.unshift(id); occupiedMonsters.add(index(at));
    }
  }
  rnd(rng, 20); // treasure-room check; treasure rooms require the full content tables
  for (let attempt = 0; attempt < 9; attempt++) if (rnd(rng, 100) < 36) {
    const choice = rnd(rng, 2); const at = findFloor(rng, layout.rooms, layout.tiles, occupiedObjects, occupiedMonsters); const id = allocate();
    entities[id] = choice === 0
      ? { kind: 'item', id, definitionId: 'food.ration', category: 'food', location: { kind: 'floor', levelId: depth, at }, quantity: 1, flags: 0, group: 0, label: null }
      : { kind: 'item', id, definitionId: 'weapon.mace', category: 'weapon', location: { kind: 'floor', levelId: depth, at }, quantity: 1, flags: 0, group: 0, label: null, hitBonus: 0, damageBonus: 0 };
    floorObjectOrder.unshift(id); occupiedObjects.add(index(at));
  }
  if (rnd(rng, 10) < depth) {
    const count = Math.min(10, rnd(rng, Math.trunc(depth / 4)) + 1); const kinds = [...ACTIVE_TRAPS] as TrapKind[];
    for (let placed = 0; placed < count; placed++) {
      const at = findFloor(rng, layout.rooms, layout.tiles, occupiedObjects, occupiedMonsters, undefined, true);
      layout.tiles[index(at)]!.feature = { kind: 'trap', trap: kinds[rnd(rng, kinds.length)]!, revealed: false };
    }
  }
  const stairs = findFloor(rng, layout.rooms, layout.tiles, occupiedObjects, occupiedMonsters);
  layout.tiles[index(stairs)]!.feature = { kind: 'stairs' };
  const playerAt = findFloor(rng, layout.rooms, layout.tiles, occupiedObjects, occupiedMonsters);
  const playerRoomId = layout.tiles[index(playerAt)]!.roomId;
  const level: LevelState = { id: depth, depth, width: GRID_WIDTH, height: GRID_HEIGHT, tiles: layout.tiles, rooms: layout.rooms,
    passages: layout.passages, stairs, monsterOrder, floorObjectOrder };
  return { profile: 'supported-slice', rng, nextEntitySerial: serial, level, entities, playerAt, playerRoomId };
}

function findFloor(rng: RandomState, rooms: RoomState[], tiles: LevelState['tiles'], objects: Set<number>, monsters: Set<number>,
  fixedRoom?: RoomState, ordinaryOnly = false): Position {
  for (let attempts = 0; attempts < 100000; attempts++) {
    let room = fixedRoom;
    if (!room) { do room = rooms[rnd(rng, 9)]!; while (room.kind === 'gone'); }
    const at = room.kind === 'maze'
      ? { x: room.origin.x + rnd(rng, Math.max(1, room.width - 2)) + 1, y: room.origin.y + rnd(rng, Math.max(1, room.height - 2)) + 1 }
      : { x: room.origin.x + rnd(rng, room.width - 2) + 1, y: room.origin.y + rnd(rng, room.height - 2) + 1 };
    const cell = tiles[index(at)]!; const usable = ordinaryOnly ? cell.terrain === 'floor' : cell.terrain === (room.kind === 'maze' ? 'passage' : 'floor');
    if (usable && !objects.has(index(at)) && !monsters.has(index(at)) && cell.feature === null) return at;
  }
  throw new Error('Unable to place generated content');
}
const index = (at: Position): number => cellIndex({ width: GRID_WIDTH, height: GRID_HEIGHT }, at);
