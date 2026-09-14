import { describe, expect, it } from 'vitest';
import { generateObject } from '../../src/engine/generation/objects';
import { createRandom } from '../../src/engine/random';

describe('source object generation', () => {
  it('is deterministic and reaches every weighted category with valid item state', () => {
    const generate = () => { const rng = createRandom(801); const context = { noFood: 0, nextGroup: 2 };
      return Array.from({ length: 1000 }, (_, index) => generateObject(rng, context, `e${index + 1}`, { kind: 'floor', levelId: 1, at: { x: 1, y: 1 } })); };
    const first = generate(); expect(first).toEqual(generate());
    expect(new Set(first.map(item => item.category))).toEqual(new Set(['potion','scroll','food','weapon','armor','ring','stick']));
    expect(first.every(item => item.definitionId.startsWith(`${item.category}.`))).toBe(true);
  });

  it('forces food after four foodless levels and serializes grouped weapon allocation', () => {
    const rng = createRandom(802); const forced = { noFood: 4, nextGroup: 9 };
    const food = generateObject(rng, forced, 'e1', { kind: 'pack', owner: 'player' });
    expect(food.category).toBe('food'); expect(forced.noFood).toBe(0);
    const context = { noFood: 0, nextGroup: 2 }; let grouped = false;
    for (let index = 0; index < 1000 && !grouped; index++) { const item = generateObject(rng, context, `e${index + 2}`, { kind: 'pack', owner: 'player' });
      grouped = item.category === 'weapon' && item.quantity > 1; }
    expect(grouped).toBe(true); expect(context.nextGroup).toBeGreaterThan(2);
  });
});
