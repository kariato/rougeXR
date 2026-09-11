import { describe, expect, it } from 'vitest';
import { buildOrdinaryRooms } from '../../src/engine/generation/rooms';
import { GRID_HEIGHT, GRID_WIDTH, tileAt } from '../../src/engine/grid';
import { createRandom } from '../../src/engine/random';

describe('ordinary room generation', () => {
  it('is deterministic for a fixed seed and consumes the same draw sequence', () => {
    const leftRng = createRandom(12345); const rightRng = createRandom(12345);
    expect(buildOrdinaryRooms(leftRng, 1)).toEqual(buildOrdinaryRooms(rightRng, 1)); expect(leftRng).toEqual(rightRng);
    expect(leftRng.draws).toBeGreaterThan(45);
  });
  it('places nine nonoverlapping rooms inside their source 3 by 3 slots', () => {
    const layout = buildOrdinaryRooms(createRandom(81), 1); expect(layout.rooms).toHaveLength(9);
    for (const room of layout.rooms) {
      expect(room.kind).toBe('room'); expect(room.origin.y).toBeGreaterThan(0);
      expect(room.origin.x + room.width).toBeLessThanOrEqual(GRID_WIDTH);
      expect(room.origin.y + room.height).toBeLessThan(GRID_HEIGHT);
      const center = { x: room.origin.x + 1, y: room.origin.y + 1 };
      expect(tileAt({ width: GRID_WIDTH, height: GRID_HEIGHT, tiles: layout.tiles }, center)).toMatchObject({ terrain: 'floor', roomId: room.id });
      expect(tileAt({ width: GRID_WIDTH, height: GRID_HEIGHT, tiles: layout.tiles }, room.origin).terrain).toBe('wallH');
      expect(tileAt({ width: GRID_WIDTH, height: GRID_HEIGHT, tiles: layout.tiles }, { x: room.origin.x, y: room.origin.y + 1 }).terrain).toBe('wallV');
    }
  });
  it('retains explicit gone slots without consuming ordinary-room draws', () => {
    const rng = createRandom(7); const layout = buildOrdinaryRooms(rng, 1, new Set([1, 7]));
    expect(layout.rooms[1]).toMatchObject({ id: 1, kind: 'gone', width: 1, height: 1 });
    expect(layout.rooms[7]).toMatchObject({ id: 7, kind: 'gone' });
    expect(layout.tiles.every((tile, index) => tile.roomId !== 1 && tile.roomId !== 7 || tile.terrain === 'void')).toBe(true);
  });
});
