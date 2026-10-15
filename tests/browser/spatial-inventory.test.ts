import { expect, it } from 'vitest';
import { inventoryActions } from '../../src/presentation/three/spatial-inventory';
const item = { token: 'e1', label: 'item', quantity: 1, category: 'weapon', equippedSlot: null, assetKey: null };
it('offers typed item actions with selected direction and correct equipment slot', () => {
  expect(inventoryActions(item, 'SW')).toEqual([
    { label: 'Equip', action: { type: 'equip', slot: 'weapon', itemId: 'e1' } },
    { label: 'Throw', action: { type: 'throw', itemId: 'e1', direction: 'SW' } },
    { label: 'Drop', action: { type: 'drop', itemId: 'e1' } },
  ]);
  expect(inventoryActions({ ...item, category: 'potion' }, 'N')[0]?.action).toEqual({ type: 'drink', itemId: 'e1' });
  expect(inventoryActions({ ...item, equippedSlot: 'weapon' }, 'N')[0]?.action).toEqual({ type: 'unequip', slot: 'weapon' });
  expect(inventoryActions({ ...item, category: 'ring' }, 'N').slice(0, 2).map(a => a.action)).toEqual([
    { type: 'equip', slot: 'leftRing', itemId: 'e1' }, { type: 'equip', slot: 'rightRing', itemId: 'e1' },
  ]);
});
