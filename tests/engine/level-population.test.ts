import { describe, expect, it } from 'vitest';
import { createTwoRoomFixture } from '../../src/debug/fixtures';
import { generateLevelContent } from '../../src/engine/generation/level';
import { cellIndex } from '../../src/engine/grid';
import { updateKnowledge } from '../../src/engine/perception/knowledge';
import { validateWorld } from '../../src/engine/validate';
import { MONSTER_DEFINITIONS } from '../../src/definitions/combat';
import { createRandom } from '../../src/engine/random';
import { instantiateMonster, randomMonster } from '../../src/engine/generation/monsters';

describe('supported generated level population', () => {
  it('defines every source monster glyph and deterministic depth selection', () => {
    expect(MONSTER_DEFINITIONS).toHaveLength(26);
    expect(MONSTER_DEFINITIONS.map(monster => monster.glyph).join('')).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    expect(randomMonster(createRandom(77), 12, false)).toEqual(randomMonster(createRandom(77), 12, false));
    const deep = instantiateMonster(createRandom(91), 30, 'e99', MONSTER_DEFINITIONS[3]!, { x: 1, y: 1 }, 0);
    expect(deep).toMatchObject({ definitionId: 'monster.dragon', stats: { level: 14, armorClass: -5 } });
  });
  it('reproduces complete content and final RNG state for a fixed seed', () => {
    expect(generateLevelContent(404, 5)).toEqual(generateLevelContent(404, 5));
  });
  it('emits only enabled entity and trap definitions without occupancy collisions', () => {
    const generated = generateLevelContent(808, 8); const occupied = new Set<string>();
    for (const entity of Object.values(generated.entities)) {
      expect(entity.definitionId.startsWith('monster.') || ['gold.pieces', 'food.ration', 'weapon.mace'].includes(entity.definitionId)).toBe(true);
      const at = entity.kind === 'monster' ? entity.at : entity.location.kind === 'floor' ? entity.location.at : null;
      expect(at).not.toBeNull(); const key = `${at!.x},${at!.y}`; expect(occupied.has(key)).toBe(false); occupied.add(key);
    }
    expect(occupied.has(`${generated.playerAt.x},${generated.playerAt.y}`)).toBe(false);
    expect(occupied.has(`${generated.level.stairs.x},${generated.level.stairs.y}`)).toBe(false);
    const trapKinds = generated.level.tiles.flatMap(tile => tile.feature?.kind === 'trap' ? [tile.feature.trap] : []);
    expect(trapKinds.every(kind => ['trapDoor', 'bear', 'sleep', 'arrow', 'teleport', 'dart', 'rust', 'mystery'].includes(kind))).toBe(true);
  });
  it('assembles into a valid world boundary with ordered registries', () => {
    const generated = generateLevelContent(2026, 6); const state = createTwoRoomFixture(2026);
    state.rng = generated.rng; state.nextEntitySerial = generated.nextEntitySerial; state.level = generated.level; state.entities = generated.entities;
    state.player.at = generated.playerAt; state.player.roomId = generated.playerRoomId; state.knowledge.levelId = generated.level.id;
    state.knowledge.remembered = Array.from({ length: generated.level.tiles.length }, () => null); updateKnowledge(state);
    expect(validateWorld(state)).toEqual([]);
    expect(state.level.tiles[cellIndex(state.level, state.level.stairs)]!.feature).toEqual({ kind: 'stairs' });
  });
});
