import { GRID_HEIGHT, GRID_WIDTH, cellIndex, positionAt } from '../grid';
import type { PassageState, Position, RandomState, RoomState, TileState } from '../model/state';
import { rnd } from '../random';
import type { RoomLayout } from './rooms';

const ADJACENT = [[1,3], [0,2,4], [1,5], [0,4,6], [1,3,5,7], [2,4,8], [3,7], [4,6,8], [5,7]] as const;
export interface PassageLayout extends RoomLayout { passages: PassageState[] }

/** passages.c do_passages/conn for ordinary rooms. */
export function buildPassages(rng: RandomState, depth: number, source: RoomLayout): PassageLayout {
  const rooms = source.rooms.map(room => ({ ...room, origin: { ...room.origin }, exits: room.exits.map(at => ({ ...at })) }));
  const tiles = source.tiles.map(tile => ({ ...tile, feature: tile.feature ? { ...tile.feature } : null }));
  const inGraph = Array<boolean>(9).fill(false); const connected = Array.from({ length: 9 }, () => Array<boolean>(9).fill(false));
  let roomCount = 1; let current = rnd(rng, 9); inGraph[current] = true;
  while (roomCount < 9) {
    let choices = 0; let target = -1;
    for (const candidate of ADJACENT[current]!) if (!inGraph[candidate] && rnd(rng, ++choices) === 0) target = candidate;
    if (choices === 0) { do current = rnd(rng, 9); while (!inGraph[current]); continue; }
    inGraph[target] = true; connect(rng, depth, rooms, tiles, current, target); connected[current]![target] = connected[target]![current] = true; roomCount++;
  }
  for (let attempts = rnd(rng, 5); attempts > 0; attempts--) {
    const from = rnd(rng, 9); let choices = 0; let target = -1;
    for (const candidate of ADJACENT[from]!) if (!connected[from]![candidate] && rnd(rng, ++choices) === 0) target = candidate;
    if (choices > 0) { connect(rng, depth, rooms, tiles, from, target); connected[from]![target] = connected[target]![from] = true; }
  }
  return { rooms, tiles, passages: numberPassages(tiles, rooms) };
}

function connect(rng: RandomState, depth: number, rooms: RoomState[], tiles: TileState[], first: number, second: number): void {
  const low = Math.min(first, second); const horizontal = Math.abs(first - second) === 1;
  const from = rooms[low]!; const to = rooms[low + (horizontal ? 1 : 3)]!;
  let start: Position; let end: Position; let delta: Position; let turnDelta: Position; let distance: number; let turnDistance: number;
  if (horizontal) {
    start = { x: from.origin.x + from.width - 1, y: from.origin.y + rnd(rng, from.height - 2) + 1 };
    end = { x: to.origin.x, y: to.origin.y + rnd(rng, to.height - 2) + 1 };
    delta = { x: 1, y: 0 }; turnDelta = { x: 0, y: start.y < end.y ? 1 : -1 };
    distance = Math.abs(start.x - end.x) - 1; turnDistance = Math.abs(start.y - end.y);
  } else {
    start = { x: from.origin.x + rnd(rng, from.width - 2) + 1, y: from.origin.y + from.height - 1 };
    end = { x: to.origin.x + rnd(rng, to.width - 2) + 1, y: to.origin.y };
    delta = { x: 0, y: 1 }; turnDelta = { x: start.x < end.x ? 1 : -1, y: 0 };
    distance = Math.abs(start.y - end.y) - 1; turnDistance = Math.abs(start.x - end.x);
  }
  if (distance < 1) throw new Error('Room boxes leave no legal corridor turn');
  const turnSpot = rnd(rng, distance - 1) + 1;
  makeDoor(rng, depth, rooms[low]!, tiles, start); makeDoor(rng, depth, rooms[low + (horizontal ? 1 : 3)]!, tiles, end);
  const current = { ...start };
  while (distance > 0) {
    current.x += delta.x; current.y += delta.y;
    if (distance === turnSpot) while (turnDistance-- > 0) { putPassage(rng, depth, tiles, current); current.x += turnDelta.x; current.y += turnDelta.y; }
    putPassage(rng, depth, tiles, current); distance--;
  }
  current.x += delta.x; current.y += delta.y;
  if (current.x !== end.x || current.y !== end.y) throw new Error('Corridor connectivity mismatch');
}

function makeDoor(rng: RandomState, depth: number, room: RoomState, tiles: TileState[], at: Position): void {
  room.exits.push({ ...at }); const tile = tiles[cellIndex({ width: GRID_WIDTH, height: GRID_HEIGHT }, at)]!;
  if (rnd(rng, 10) + 1 < depth && rnd(rng, 5) === 0) { tile.secret = true; }
  else { tile.terrain = 'door'; tile.secret = false; }
}

function putPassage(rng: RandomState, depth: number, tiles: TileState[], at: Position): void {
  const tile = tiles[cellIndex({ width: GRID_WIDTH, height: GRID_HEIGHT }, at)]!;
  tile.roomId = null;
  if (rnd(rng, 10) + 1 < depth && rnd(rng, 40) === 0) { tile.terrain = 'void'; tile.secret = true; }
  else { tile.terrain = 'passage'; tile.secret = false; }
}

function numberPassages(tiles: TileState[], rooms: RoomState[]): PassageState[] {
  const exits = new Set(rooms.flatMap(room => room.exits.map(at => cellIndex({ width: GRID_WIDTH, height: GRID_HEIGHT }, at))));
  const traversable = (index: number): boolean => {
    const tile = tiles[index]; return !!tile && (tile.terrain === 'passage' || tile.terrain === 'door' || tile.secret && (tile.roomId === null || exits.has(index)));
  };
  const seen = new Set<number>(); const passages: PassageState[] = [];
  for (let index = 0; index < tiles.length; index++) {
    if (!traversable(index) || seen.has(index)) continue;
    const id = passages.length + 1; const cells: number[] = []; const pending = [index]; seen.add(index);
    while (pending.length) {
      const cell = pending.pop()!; cells.push(cell); const at = positionAt({ width: GRID_WIDTH, height: GRID_HEIGHT }, cell);
      for (const next of [{ x: at.x + 1, y: at.y }, { x: at.x - 1, y: at.y }, { x: at.x, y: at.y + 1 }, { x: at.x, y: at.y - 1 }]) {
        if (next.x < 0 || next.x >= GRID_WIDTH || next.y <= 0 || next.y >= GRID_HEIGHT - 1) continue;
        const nextIndex = cellIndex({ width: GRID_WIDTH, height: GRID_HEIGHT }, next);
        if (traversable(nextIndex) && !seen.has(nextIndex)) { seen.add(nextIndex); pending.push(nextIndex); }
      }
    }
    cells.sort((a, b) => a - b); for (const cell of cells) tiles[cell]!.passageId = id; passages.push({ id, cells });
  }
  return passages;
}
