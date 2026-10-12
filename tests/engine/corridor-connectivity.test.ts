import { expect, it } from 'vitest';
import { generateLevelContent } from '../../src/engine/generation/level';

it('keeps stairs reachable through rooms, corridors, and searchable secret passages', () => {
  for (const depth of [1, 2, 10, 20, 26]) for (let seed = 1; seed <= 200; seed++) {
    const { level, playerAt } = generateLevelContent(seed, depth);
    const start = playerAt.y * level.width + playerAt.x;
    const seen = new Set([start]); const pending = [start];
    while (pending.length) {
      const index = pending.pop()!; const x = index % level.width; const y = Math.floor(index / level.width);
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        const nx = x + dx!, ny = y + dy!;
        if (nx < 0 || nx >= level.width || ny <= 0 || ny >= level.height - 1) continue;
        const next = ny * level.width + nx, tile = level.tiles[next]!;
        if (seen.has(next) || !(tile.secret || ['floor', 'door', 'passage'].includes(tile.terrain))) continue;
        seen.add(next); pending.push(next);
      }
    }
    expect(seen.has(level.stairs.y * level.width + level.stairs.x), `seed ${seed}, depth ${depth}`).toBe(true);
  }
});
