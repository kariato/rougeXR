import { describe, expect, it } from 'vitest';
import { buildRooms } from '../../src/engine/generation/rooms';
import { clearDecorationApproaches, createRoomDesign } from '../../src/engine/generation/room-design';
import { createRandom } from '../../src/engine/random';
import { createNewGame } from '../../src/engine/new-game';
import { observe } from '../../src/engine/perception/knowledge';

describe('creation-time room design', () => {
  it('creates deterministic themes and decorations without a gameplay RNG dependency', () => {
    const room = { id: 3, origin: { x: 10, y: 4 }, width: 9, height: 7, kind: 'room' as const, dark: false };
    expect(createRoomDesign(room, 12)).toEqual(createRoomDesign(room, 12));
    const design = createRoomDesign(room, 12);
    expect(['dungeon', 'crypt', 'store']).toContain(design.theme);
    expect(design.decorations.filter(entry => entry.kind !== 'torch').every(entry => entry.at.x > 10 && entry.at.x < 18 && entry.at.y > 4 && entry.at.y < 10)).toBe(true);
    const torches = design.decorations.filter(entry => entry.kind === 'torch');
    expect(torches.length).toBeGreaterThanOrEqual(2);
    expect(torches.every(entry => entry.at.x === 10 || entry.at.x === 18 || entry.at.y === 4 || entry.at.y === 10)).toBe(true);
    const inward = [{ x: 0, y: 1 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: -1, y: 0 }];
    expect(torches.every(entry => {
      const direction = inward[entry.rotation]!;
      const next = { x: entry.at.x + direction.x, y: entry.at.y + direction.y };
      return next.x > 10 && next.x < 18 && next.y > 4 && next.y < 10;
    })).toBe(true);
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

  it('projects created torches only from disclosed cells', () => {
    const state = createNewGame(12345);
    const observation = observe(state);
    const planned = state.level.rooms.flatMap(room => room.design.decorations).filter(decoration => decoration.kind === 'torch');
    const disclosed = observation.decorations.filter(decoration => decoration.kind === 'torch');
    expect(planned.length).toBeGreaterThan(disclosed.length);
    expect(disclosed.length).toBeGreaterThan(0);
    expect(disclosed.every(decoration => observation.cells[decoration.at.y * observation.width + decoration.at.x]?.visibility !== 'unknown')).toBe(true);
  });
});
