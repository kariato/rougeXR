import { describe, expect, it } from 'vitest';
import { createTwoRoomFixture } from '../../src/debug/fixtures';
import { allocateId } from '../../src/engine/entities';
import { POTION_COLORS, POTION_DEFINITIONS, initializePotionIdentification } from '../../src/engine/identification';
import type { ItemState } from '../../src/engine/model/state';
import { createRandom } from '../../src/engine/random';
import { observe } from '../../src/engine/perception/knowledge';
import { GameSession } from '../../src/engine/session';
import { parseSave, serializeSave } from '../../src/persistence/save';

describe('potion identification', () => {
  it('uses source-order rejection sampling to assign distinct colors', () => {
    const rng = createRandom(12345); const entries = initializePotionIdentification(rng);
    expect(entries.map(entry => entry.definitionId)).toEqual(POTION_DEFINITIONS.map(([id]) => id));
    expect(entries.map(entry => entry.appearanceId)).toEqual([
      'black', 'blue', 'tan', 'tangerine', 'crimson', 'gold', 'yellow',
      'aquamarine', 'white', 'magenta', 'brown', 'topaz', 'silver', 'turquoise',
    ]);
    expect(new Set(entries.map(entry => entry.appearanceId)).size).toBe(entries.length);
    expect(entries.every(entry => POTION_COLORS.includes(entry.appearanceId as typeof POTION_COLORS[number]))).toBe(true);
  });

  it('shows appearance, calls, and known names without changing the item', () => {
    const state = createTwoRoomFixture(9); const id = allocateId(state);
    const potion: ItemState = { kind: 'item', id, definitionId: 'potion.healing', category: 'potion',
      location: { kind: 'pack', owner: 'player' }, quantity: 1, flags: 0, group: 0, label: null };
    state.entities[id] = potion; state.player.packOrder.push(id);
    const entry = state.identification.find(candidate => candidate.definitionId === potion.definitionId)!;
    expect(observe(state).inventory.at(-1)?.label).toBe(`${entry.appearanceId} potion`);
    entry.called = 'medicine';
    expect(observe(state).inventory.at(-1)?.label).toBe(`potion called medicine (${entry.appearanceId})`);
    entry.known = true;
    expect(observe(state).inventory.at(-1)?.label).toBe(`potion of healing (${entry.appearanceId})`);
    expect(potion).toMatchObject({ definitionId: 'potion.healing', label: null });
  });

  it('round-trips the randomized mapping through the save envelope', () => {
    const state = new GameSession(createTwoRoomFixture(42)).exportState(); const before = structuredClone(state.identification);
    const parsed = parseSave(serializeSave(state));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value.state.identification).toEqual(before);
  });
});
