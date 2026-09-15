import type { DecorationKind, RoomDesign, RoomState, RoomTheme } from '../model/state';

type RoomShape = Pick<RoomState, 'id' | 'origin' | 'width' | 'height' | 'kind' | 'dark'>;

/** Creates cosmetic room metadata without consuming the source gameplay RNG. */
export function createRoomDesign(room: RoomShape, depth: number, forcedTheme?: RoomTheme): RoomDesign {
  if (room.kind === 'gone') return { token: visualToken(room, depth), theme: 'none', baseTheme: 'none', condition: conditionFor(depth), decorations: [] };
  const seed = hashWords(depth, room.id, room.origin.x, room.origin.y, room.width, room.height);
  const theme = forcedTheme ?? chooseTheme(room, depth, seed);
  const kinds = decorationKinds(theme); const decorations: RoomDesign['decorations'] = [];
  for (let y = room.origin.y + 1; y < room.origin.y + room.height - 1; y++) for (let x = room.origin.x + 1; x < room.origin.x + room.width - 1; x++) {
    const cellHash = hashWords(seed, x, y);
    if (cellHash % densityDivisor(theme) !== 0) continue;
    const kind = kinds[(cellHash >>> 8) % kinds.length]!;
    decorations.push({ id: `decor-${(cellHash >>> 0).toString(16)}-${x}-${y}`, kind, at: { x, y },
      rotation: decorationRotation(room, kind, x, y, cellHash), variant: (cellHash >>> 20) % 3, scale: 0.82 + ((cellHash >>> 24) & 7) * 0.04 });
  }
  if (room.kind === 'room') decorations.push(...wallTorches(room, seed));
  return { token: visualToken(room, depth), theme, baseTheme: forcedTheme ? room.kind === 'maze' ? 'cave' : chooseTheme(room, depth, seed) : theme,
    condition: conditionFor(depth), decorations };
}

function decorationRotation(room: RoomShape, kind: DecorationKind, x: number, y: number, hash: number): 0 | 1 | 2 | 3 {
  if (kind !== 'crate') return ((hash >>> 16) & 3) as 0 | 1 | 2 | 3;
  const distances = [y - room.origin.y, x - room.origin.x,
    room.origin.y + room.height - 1 - y, room.origin.x + room.width - 1 - x];
  return distances.indexOf(Math.min(...distances)) as 0 | 1 | 2 | 3;
}

/** Rotation 0 faces into the room from its top wall; subsequent sides turn clockwise. */
function wallTorches(room: RoomShape, seed: number): RoomDesign['decorations'] {
  const x = room.origin.x, y = room.origin.y;
  const walls: Array<{ at: { x: number; y: number }; rotation: 0 | 1 | 2 | 3 }> = [];
  for (const side of [0, 1, 2, 3] as const) {
    const span = side % 2 === 0 ? room.width : room.height;
    const first = 1 + hashWords(seed, side) % Math.min(4, span - 2);
    for (let offset = first; offset < span - 1; offset += 6) {
      const at = side === 0 ? { x: x + offset, y }
        : side === 1 ? { x, y: y + offset }
          : side === 2 ? { x: x + offset, y: y + room.height - 1 }
            : { x: x + room.width - 1, y: y + offset };
      walls.push({ at, rotation: side });
    }
  }
  return walls.map(({ at, rotation }, index) => {
    const value = hashWords(seed, at.x, at.y, rotation);
    return { id: `torch-${(value >>> 0).toString(16)}-${at.x}-${at.y}`, kind: 'torch' as const, at, rotation,
      variant: (value >>> 18) % 3, scale: .86 + (value % 5) * .04 };
  });
}

export function redesignRoom(room: RoomState, depth: number, theme: RoomTheme): void {
  room.design = createRoomDesign(room, depth, theme);
}

export function clearDecorationApproaches(rooms: RoomState[]): void {
  for (const room of rooms) room.design.decorations = room.design.decorations.filter(decoration =>
    room.exits.every(exit => Math.abs(exit.x - decoration.at.x) + Math.abs(exit.y - decoration.at.y) > 1));
}

function chooseTheme(room: RoomShape, depth: number, seed: number): RoomTheme {
  if (room.kind === 'maze') return 'cave';
  const roll = seed % 100;
  if (depth >= 9 && roll < 28) return 'crypt';
  if (roll >= 72) return 'store';
  return 'dungeon';
}

function decorationKinds(theme: RoomTheme): DecorationKind[] {
  if (theme === 'cave') return ['rubble', 'mushroom', 'bones'];
  if (theme === 'crypt') return ['urn', 'pillar', 'bones'];
  if (theme === 'store') return ['crate', 'rubble'];
  if (theme === 'treasure') return ['coinScatter', 'pillar', 'urn', 'crate'];
  return ['rubble', 'pillar'];
}

function densityDivisor(theme: RoomTheme): number { return theme === 'treasure' ? 5 : theme === 'cave' ? 7 : 9; }
function conditionFor(depth: number): 0 | 1 | 2 { return depth <= 8 ? 0 : depth <= 17 ? 1 : 2; }
function visualToken(room: RoomShape, depth: number): string { return `vr-${hashWords(0x9e3779b9, depth, room.id, room.origin.x, room.origin.y).toString(16).padStart(8, '0')}`; }
function hashWords(...values: number[]): number {
  let value = 0x811c9dc5;
  for (const input of values) { value ^= input >>> 0; value = Math.imul(value, 0x01000193); value ^= value >>> 13; }
  return value >>> 0;
}
