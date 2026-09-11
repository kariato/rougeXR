import { GRID_HEIGHT, GRID_WIDTH, cellIndex } from '../grid';
import type { RandomState, RoomState, TileState } from '../model/state';
import { rnd } from '../random';

export interface RoomLayout { rooms: RoomState[]; tiles: TileState[] }

/**
 * rooms.c ordinary-room branch. Gone-room selection and maze carving belong to
 * Phase 9.3; callers pass those slots explicitly once that layer is available.
 */
export function buildOrdinaryRooms(rng: RandomState, depth: number, excludedSlots: ReadonlySet<number> = new Set()): RoomLayout {
  if (!Number.isSafeInteger(depth) || depth < 1) throw new RangeError('Depth must be positive');
  const boxWidth = Math.trunc(GRID_WIDTH / 3); const boxHeight = Math.trunc(GRID_HEIGHT / 3);
  const tiles = Array.from({ length: GRID_WIDTH * GRID_HEIGHT }, (): TileState => ({
    terrain: 'void', secret: false, feature: null, roomId: null, passageId: null,
  }));
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
    let width = 0; let height = 0; let x = 0; let y = 0;
    do {
      width = rnd(rng, boxWidth - 4) + 4; height = rnd(rng, boxHeight - 4) + 4;
      x = top.x + rnd(rng, boxWidth - width); y = top.y + rnd(rng, boxHeight - height);
    } while (y === 0);
    const room: RoomState = { id, origin: { x, y }, width, height, kind: 'room', dark, exits: [], goldTarget: null };
    rooms.push(room); drawOrdinaryRoom(tiles, room);
  }
  return { rooms, tiles };
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
