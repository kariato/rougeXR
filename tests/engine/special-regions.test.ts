import { describe, expect, it } from 'vitest';
import { buildPassages } from '../../src/engine/generation/passages';
import { buildRooms } from '../../src/engine/generation/rooms';
import { GRID_HEIGHT, GRID_WIDTH, cellIndex } from '../../src/engine/grid';
import { createRandom } from '../../src/engine/random';

describe('gone and maze regions', () => {
  it('selects unique gone slots and reproduces a fixed seed exactly', () => {
    const leftRng = createRandom(321); const rightRng = createRandom(321);
    const left = buildRooms(leftRng, 1); const right = buildRooms(rightRng, 1);
    expect(left).toEqual(right); expect(leftRng).toEqual(rightRng);
    const gone = left.rooms.filter(room => room.kind === 'gone'); expect(gone.length).toBeLessThanOrEqual(3);
    expect(new Set(gone.map(room => room.id)).size).toBe(gone.length);
    for (const room of gone) { expect(room.origin.y).toBeGreaterThan(0); expect(room.origin.y).toBeLessThan(GRID_HEIGHT - 1); }
  });
  it('carves deterministic maze regions and connects special endpoints', () => {
    let selected: { rng: ReturnType<typeof createRandom>; layout: ReturnType<typeof buildRooms> } | null = null;
    for (let seed = 1; seed <= 500 && !selected; seed++) {
      const rng = createRandom(seed); const layout = buildRooms(rng, 20);
      if (layout.rooms.some(room => room.kind === 'maze') && layout.rooms.some(room => room.kind === 'gone')) selected = { rng, layout };
    }
    expect(selected).not.toBeNull(); const complete = buildPassages(selected!.rng, 20, selected!.layout);
    const maze = complete.rooms.find(room => room.kind === 'maze')!; const gone = complete.rooms.find(room => room.kind === 'gone')!;
    expect(maze.exits.length).toBeGreaterThan(0); expect(gone.exits.length).toBeGreaterThan(0);
    expect(complete.tiles.some(tile => tile.roomId === maze.id && (tile.terrain === 'passage' || tile.secret))).toBe(true);
    const goneIndex = cellIndex({ width: GRID_WIDTH, height: GRID_HEIGHT }, gone.origin);
    expect(complete.tiles[goneIndex]).toMatchObject({ roomId: null, passageId: expect.any(Number) });
  });
  it('keeps all carved and hidden passage cells assigned to a component', () => {
    const rng = createRandom(93); const layout = buildPassages(rng, 15, buildRooms(rng, 15));
    for (let index = 0; index < layout.tiles.length; index++) {
      const tile = layout.tiles[index]!;
      if (tile.terrain === 'passage' || tile.terrain === 'door' || tile.secret) expect(tile.passageId).not.toBeNull();
    }
  });
});
