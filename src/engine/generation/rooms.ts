import { GRID_HEIGHT, GRID_WIDTH, cellIndex } from '../grid';
import type { RandomState, RoomState, TileState } from '../model/state';
import { rnd } from '../random';

export interface RoomLayout { rooms: RoomState[]; tiles: TileState[] }

/** Complete rooms.c room selection, including gone and maze slots. */
export function buildRooms(rng: RandomState, depth: number): RoomLayout {
  if (!Number.isSafeInteger(depth) || depth < 1) throw new RangeError('Depth must be positive');
  const gone = new Set<number>();
  for (let count = rnd(rng, 4); count > 0; count--) {
    let id: number; do id = rnd(rng, 9); while (gone.has(id)); gone.add(id);
  }
  const boxWidth = Math.trunc(GRID_WIDTH / 3); const boxHeight = Math.trunc(GRID_HEIGHT / 3);
  const tiles = emptyTiles(); const rooms: RoomState[] = [];
  for (let id = 0; id < 9; id++) {
    const top = { x: (id % 3) * boxWidth + 1, y: Math.trunc(id / 3) * boxHeight };
    if (gone.has(id)) {
      let origin: { x: number; y: number };
      do origin = { x: top.x + rnd(rng, boxWidth - 2) + 1, y: top.y + rnd(rng, boxHeight - 2) + 1 };
      while (origin.y <= 0 || origin.y >= GRID_HEIGHT - 1);
      rooms.push({ id, origin, width: 1, height: 1, kind: 'gone', dark: false, exits: [], goldTarget: null }); continue;
    }
    let dark = false; let maze = false;
    if (rnd(rng, 10) < depth - 1) { dark = true; if (rnd(rng, 15) === 0) { maze = true; dark = false; } }
    if (maze) {
      let origin = { ...top }; let width = boxWidth - 1; let height = boxHeight - 1;
      if (origin.x === 1) origin.x = 0; if (origin.y === 0) { origin.y++; height--; }
      const room: RoomState = { id, origin, width, height, kind: 'maze', dark: false, exits: [], goldTarget: null };
      rooms.push(room); carveMaze(rng, depth, tiles, room); continue;
    }
    const room = createOrdinaryRoom(rng, id, top, boxWidth, boxHeight, dark); rooms.push(room); drawOrdinaryRoom(tiles, room);
  }
  return { rooms, tiles };
}

/**
 * rooms.c ordinary-room branch. Gone-room selection and maze carving belong to
 * Phase 9.3; callers pass those slots explicitly once that layer is available.
 */
export function buildOrdinaryRooms(rng: RandomState, depth: number, excludedSlots: ReadonlySet<number> = new Set()): RoomLayout {
  if (!Number.isSafeInteger(depth) || depth < 1) throw new RangeError('Depth must be positive');
  const boxWidth = Math.trunc(GRID_WIDTH / 3); const boxHeight = Math.trunc(GRID_HEIGHT / 3);
  const tiles = emptyTiles();
  const rooms: RoomState[] = [];
  for (let id = 0; id < 9; id++) {
    const top = { x: (id % 3) * boxWidth + 1, y: Math.trunc(id / 3) * boxHeight };
    if (excludedSlots.has(id)) {
      rooms.push({ id, origin: { x: top.x + 1, y: Math.max(1, top.y + 1) }, width: 1, height: 1,
        kind: 'gone', dark: false, exits: [], goldTarget: null }); continue;
    }
    let dark = false;
    if (rnd(rng, 10) < depth - 1) {
      dark = true;
      if (rnd(rng, 15) === 0) throw new Error('Maze room selected before Phase 9.3');
    }
    const room = createOrdinaryRoom(rng, id, top, boxWidth, boxHeight, dark);
    rooms.push(room); drawOrdinaryRoom(tiles, room);
  }
  return { rooms, tiles };
}

function emptyTiles(): TileState[] { return Array.from({ length: GRID_WIDTH * GRID_HEIGHT }, (): TileState => ({ terrain: 'void', secret: false, feature: null, roomId: null, passageId: null })); }
function createOrdinaryRoom(rng: RandomState, id: number, top: { x: number; y: number }, boxWidth: number, boxHeight: number, dark: boolean): RoomState {
  let width = 0; let height = 0; let x = 0; let y = 0;
  do { width = rnd(rng, boxWidth - 4) + 4; height = rnd(rng, boxHeight - 4) + 4;
    x = top.x + rnd(rng, boxWidth - width); y = top.y + rnd(rng, boxHeight - height); } while (y === 0);
  return { id, origin: { x, y }, width, height, kind: 'room', dark, exits: [], goldTarget: null };
}

function carveMaze(rng: RandomState, depth: number, tiles: TileState[], room: RoomState): void {
  const start = { x: Math.trunc(rnd(rng, room.width) / 2) * 2, y: Math.trunc(rnd(rng, room.height) / 2) * 2 };
  const visited = new Set<string>(); const key = (x: number, y: number): string => `${x},${y}`;
  const put = (x: number, y: number): void => {
    const at = { x: room.origin.x + x, y: room.origin.y + y }; const tile = tiles[cellIndex({ width: GRID_WIDTH, height: GRID_HEIGHT }, at)]!;
    tile.roomId = room.id;
    if (rnd(rng, 10) + 1 < depth && rnd(rng, 40) === 0) { tile.terrain = 'void'; tile.secret = true; }
    else { tile.terrain = 'passage'; tile.secret = false; }
  };
  const dig = (x: number, y: number): void => {
    visited.add(key(x, y)); put(x, y);
    while (true) {
      let count = 0; let next: { x: number; y: number } | null = null;
      for (const delta of [{ x: 2, y: 0 }, { x: -2, y: 0 }, { x: 0, y: 2 }, { x: 0, y: -2 }]) {
        const candidate = { x: x + delta.x, y: y + delta.y };
        if (candidate.x < 0 || candidate.x > room.width || candidate.y < 0 || candidate.y > room.height || visited.has(key(candidate.x, candidate.y))) continue;
        if (rnd(rng, ++count) === 0) next = candidate;
      }
      if (!next) return;
      put(x + Math.sign(next.x - x), y + Math.sign(next.y - y)); dig(next.x, next.y);
    }
  };
  dig(start.x, start.y);
}

function drawOrdinaryRoom(tiles: TileState[], room: RoomState): void {
  for (let y = room.origin.y; y < room.origin.y + room.height; y++) for (let x = room.origin.x; x < room.origin.x + room.width; x++) {
    const horizontal = y === room.origin.y || y === room.origin.y + room.height - 1;
    const vertical = x === room.origin.x || x === room.origin.x + room.width - 1;
    const terrain = horizontal ? 'wallH' : vertical ? 'wallV' : 'floor';
    tiles[cellIndex({ width: GRID_WIDTH, height: GRID_HEIGHT }, { x, y })] = {
      terrain, secret: false, feature: null, roomId: room.id, passageId: null,
    };
  }
}
