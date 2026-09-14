import { describe, expect, it } from 'vitest';
import { buildRooms } from '../../src/engine/generation/rooms';
import { clearDecorationApproaches, createRoomDesign } from '../../src/engine/generation/room-design';
import { createRandom } from '../../src/engine/random';

describe('creation-time room design', () => {
  it('creates deterministic themes and decorations without a gameplay RNG dependency', () => {
    const room = { id: 3, origin: { x: 10, y: 4 }, width: 9, height: 7, kind: 'room' as const, dark: false };
    expect(createRoomDesign(room, 12)).toEqual(createRoomDesign(room, 12));
    const design = createRoomDesign(room, 12);
    expect(['dungeon', 'crypt', 'store']).toContain(design.theme);
    expect(design.decorations.every(entry => entry.at.x > 10 && entry.at.x < 18 && entry.at.y > 4 && entry.at.y < 10)).toBe(true);
  });

  it('designs mazes as caves while gone slots remain undecorated', () => {
    const cave = createRoomDesign({ id: 1, origin: { x: 1, y: 1 }, width: 8, height: 6, kind: 'maze', dark: false }, 20);
    const gone = createRoomDesign({ id: 2, origin: { x: 1, y: 1 }, width: 1, height: 1, kind: 'gone', dark: false }, 20);
    expect(cave.theme).toBe('cave'); expect(gone).toMatchObject({ theme: 'none', decorations: [] });
  });

  it('stores designs on every generated room and clears doorway approaches', () => {
    const layout = buildRooms(createRandom(91234), 15);
    expect(layout.rooms.every(room => room.design.token.length > 0)).toBe(true);
    const room = layout.rooms.find(candidate => candidate.design.decorations.length)!;
    const decoration = room.design.decorations[0]!; room.exits.push({ x: decoration.at.x + 1, y: decoration.at.y });
    clearDecorationApproaches(layout.rooms);
    expect(room.design.decorations).not.toContainEqual(decoration);
  });
});
