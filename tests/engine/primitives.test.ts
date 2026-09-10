import { describe, expect, it } from 'vitest';
import { createTwoRoomFixture } from '../../src/debug/fixtures';
import { allocateId, buildIndexes, transferItem } from '../../src/engine/entities';
import { cellIndex, inBounds, isPlayable, positionAt } from '../../src/engine/grid';
import { createRandom, nextU32, rnd, roll } from '../../src/engine/random';
import { validateWorld } from '../../src/engine/validate';

describe('grid', () => {
  const dimensions = { width: 80, height: 24 };
  it('round trips every allocated cell and distinguishes reserved rows', () => {
    for (let i = 0; i < 1920; i++) expect(cellIndex(dimensions, positionAt(dimensions, i))).toBe(i);
    expect(isPlayable(dimensions, { x: 79, y: 22 })).toBe(true);
    expect(isPlayable(dimensions, { x: 0, y: 23 })).toBe(false);
    expect(isPlayable(dimensions, { x: 0, y: 0 })).toBe(false);
  });
  it.each([{ x: -1, y: 1 }, { x: 80, y: 1 }, { x: 0, y: 24 }, { x: 0.5, y: 1 }, { x: NaN, y: 1 }])('rejects invalid position %j', at => {
    expect(inBounds(dimensions, at)).toBe(false);
    expect(() => cellIndex(dimensions, at)).toThrow();
  });
});
describe('randomness', () => {
  it('matches the specified known vector', () => {
    const r = createRandom(1);
    expect([nextU32(r), nextU32(r), nextU32(r)]).toEqual([270369, 67634689, 2647435461]);
    expect(r.draws).toBe(3);
  });
  it('preserves zero seed mapping and exact zero/one range draw counts', () => {
    const r = createRandom(0);
    expect(r.word).toBe(0x6d2b79f5);
    expect(rnd(r, 0)).toBe(0); expect(r.draws).toBe(0);
    expect(rnd(r, 1)).toBe(0); expect(r.draws).toBe(1);
  });
  it('rolls each die and continues after JSON round trip', () => {
    const r = createRandom(99); const manual = createRandom(99);
    expect(roll(r, 3, 6)).toBe(rnd(manual, 6) + rnd(manual, 6) + rnd(manual, 6) + 3);
    const restored = JSON.parse(JSON.stringify(r));
    expect(nextU32(restored)).toBe(nextU32(r));
    expect(roll(r, 0, 6)).toBe(0);
  });
  it('rejects invalid requests before drawing', () => {
    const r = createRandom(1);
    expect(() => rnd(r, -1)).toThrow(); expect(() => roll(r, 2, -1)).toThrow();
    expect(r.draws).toBe(0);
    expect(() => createRandom(2 ** 32)).toThrow();
  });
});
describe('ownership and validation', () => {
  it('produces independent deterministic JSON fixtures', () => {
    const first = createTwoRoomFixture(); const second = createTwoRoomFixture();
    expect(first).toEqual(second); expect(validateWorld(first)).toEqual([]);
    expect(validateWorld(JSON.parse(JSON.stringify(first)))).toEqual([]);
    first.player.at.x++; expect(first).not.toEqual(second);
  });
  it('indexes a monster standing over an item and rejects duplicate occupancy', () => {
    const s = createTwoRoomFixture(); const index = cellIndex(s.level, { x: 23, y: 5 });
    expect(buildIndexes(s).monsters.get(index)).toBe('e1');
    expect(buildIndexes(s).objects.get(index)).toBe('e2');
    const id = allocateId(s); s.entities[id] = { ...s.entities.e2!, id };
    s.level.floorObjectOrder.push(id);
    expect(() => buildIndexes(s)).toThrow('Duplicate occupancy');
    expect(validateWorld(s).length).toBeGreaterThan(0);
  });
  it('moves floor -> player -> monster -> floor without losing order or ownership', () => {
    const s = createTwoRoomFixture();
    for (const destination of [{ kind: 'pack', owner: 'player' }, { kind: 'pack', owner: 'e1' }, { kind: 'floor', levelId: 1, at: { x: 6, y: 5 } }] as const) {
      transferItem(s, 'e2', destination); expect(validateWorld(s)).toEqual([]);
    }
    expect(s.player.packOrder).toEqual([]); expect(s.level.floorObjectOrder).toEqual(['e2']);
    expect(allocateId(s)).toBe('e3'); expect(allocateId(s)).toBe('e4');
  });
  it('validates before mutation and does not alias caller positions', () => {
    const s = createTwoRoomFixture(); const before = JSON.stringify(s);
    expect(() => transferItem(s, 'e2', { kind: 'pack', owner: 'missing' })).toThrow();
    expect(() => transferItem(s, 'e2', { kind: 'floor', levelId: 1, at: { x: 0, y: 0 } })).toThrow();
    expect(JSON.stringify(s)).toBe(before);
    const at = { x: 6, y: 5 }; transferItem(s, 'e2', { kind: 'floor', levelId: 1, at }); at.x = 79;
    expect(validateWorld(s)).toEqual([]);
  });
  it.each(['id', 'position', 'ownership', 'serial', 'nan', 'stairs', 'rng'])('rejects corrupted %s', corruption => {
    const s = createTwoRoomFixture();
    if (corruption === 'id') s.entities.e2!.id = 'wrong';
    if (corruption === 'position') s.player.at.x = 100;
    if (corruption === 'ownership') s.player.packOrder.push('e2');
    if (corruption === 'serial') s.nextEntitySerial = 1;
    if (corruption === 'nan') s.player.gold = NaN;
    if (corruption === 'stairs') s.level.stairs = { x: 7, y: 5 };
    if (corruption === 'rng') s.rng.word = 0;
    expect(validateWorld(s).length).toBeGreaterThan(0);
  });
  it('handles malformed input without throwing', () => {
    for (const input of [null, {}, { level: [] }, new Date(), undefined]) expect(validateWorld(input).length).toBeGreaterThan(0);
  });
});
