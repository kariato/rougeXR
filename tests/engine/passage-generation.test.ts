import { describe, expect, it } from 'vitest';
import { buildPassages } from '../../src/engine/generation/passages';
import { buildOrdinaryRooms } from '../../src/engine/generation/rooms';
import { GRID_HEIGHT, GRID_WIDTH, cellIndex } from '../../src/engine/grid';
import { createRandom } from '../../src/engine/random';

function generated(seed: number, depth = 1) { const rng = createRandom(seed); return { rng, layout: buildPassages(rng, depth, buildOrdinaryRooms(rng, depth)) }; }

describe('passage generation', () => {
  it('is deterministic including graph choices, doors, and corridor turns', () => {
    const left = generated(12345); const right = generated(12345); expect(left).toEqual(right);
    expect(left.layout.rooms.every(room => room.exits.length > 0)).toBe(true);
  });
  it('potentially connects the interior of all nine ordinary rooms', () => {
    const { layout } = generated(77); const start = { x: layout.rooms[0]!.origin.x + 1, y: layout.rooms[0]!.origin.y + 1 };
    const pending = [cellIndex({ width: GRID_WIDTH, height: GRID_HEIGHT }, start)]; const seen = new Set(pending);
    while (pending.length) {
      const index = pending.pop()!; const x = index % GRID_WIDTH; const y = Math.trunc(index / GRID_WIDTH);
      for (const at of [{ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 }]) {
        if (at.x < 0 || at.x >= GRID_WIDTH || at.y <= 0 || at.y >= GRID_HEIGHT - 1) continue;
        const next = cellIndex({ width: GRID_WIDTH, height: GRID_HEIGHT }, at); const tile = layout.tiles[next]!;
        if (!seen.has(next) && (['floor', 'door', 'passage'].includes(tile.terrain) || tile.secret)) { seen.add(next); pending.push(next); }
      }
    }
    for (const room of layout.rooms) expect(seen.has(cellIndex({ width: GRID_WIDTH, height: GRID_HEIGHT }, { x: room.origin.x + 1, y: room.origin.y + 1 }))).toBe(true);
  });
  it('numbers every door and passage cell exactly once', () => {
    const { layout } = generated(9001, 1); const listed = layout.passages.flatMap(passage => passage.cells);
    expect(new Set(listed).size).toBe(listed.length); expect(listed.length).toBeGreaterThan(20);
    for (const passage of layout.passages) for (const index of passage.cells) expect(layout.tiles[index]!.passageId).toBe(passage.id);
    for (const room of layout.rooms) for (const exit of room.exits) expect(layout.tiles[cellIndex({ width: GRID_WIDTH, height: GRID_HEIGHT }, exit)]).toMatchObject({ terrain: 'door', passageId: expect.any(Number) });
  });
});
