import { describe, expect, it } from 'vitest';
import { ROOM_LOOKS, ROOM_MATERIAL_VERSION, surfaceVariant } from '../../src/presentation/three/room-materials';

describe('procedural room materials', () => {
  it('defines a distinct surface and lighting language for every room family', () => {
    expect(ROOM_MATERIAL_VERSION).toBeGreaterThan(0);
    for (const theme of ['dungeon', 'cave', 'crypt', 'store', 'treasure'] as const) {
      expect(ROOM_LOOKS[theme].floor).not.toBe(ROOM_LOOKS[theme].wall);
    }
    expect(new Set(['dungeon', 'cave', 'crypt', 'store', 'treasure'].map(theme => ROOM_LOOKS[theme as keyof typeof ROOM_LOOKS].floor)).size).toBe(5);
  });

  it('varies surfaces deterministically without an RNG input', () => {
    const first = Array.from({ length: 20 }, (_, x) => surfaceVariant('crypt', 'floor', x, 7));
    expect(first).toEqual(Array.from({ length: 20 }, (_, x) => surfaceVariant('crypt', 'floor', x, 7)));
    expect(new Set(first).size).toBeGreaterThan(1);
    expect(first.every(variant => variant >= 0 && variant < 4)).toBe(true);
    expect(surfaceVariant('crypt', 'floor', 5, 7)).not.toBe(surfaceVariant('store', 'wall', 5, 7));
  });
});
