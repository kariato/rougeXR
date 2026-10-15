import { expect, it } from 'vitest';
import { createTwoRoomFixture } from '../../src/debug/fixtures';
import { cellIndex, canOccupyFloor, isSolidDecoration, supportsOccupant } from '../../src/engine/grid';
import { generateLevelContent } from '../../src/engine/generation/level';
import { observe } from '../../src/engine/perception/knowledge';
import { GameSession } from '../../src/engine/session';
import { resolveMove } from '../../src/engine/rules/movement';
import type { DecorationKind } from '../../src/engine/model/state';

it.each<DecorationKind>(['crate', 'rubble', 'pillar', 'urn', 'mushroom'])('%s blocks stepping into it and diagonal corner cutting', kind => {
  const state = createTwoRoomFixture();
  state.level.rooms[0]!.design.decorations.push({ id: 'solid', kind, at: { x: 6, y: 5 }, rotation: 0, variant: 0, scale: 1 });
  const before = structuredClone(state.player.at), rng = structuredClone(state.rng);
  expect(resolveMove(state, 'E', true)).toMatchObject({ resolved: false, consumedSlot: false, reason: 'blocked' });
  expect(resolveMove(state, 'NE', true)).toMatchObject({ resolved: false, consumedSlot: false, reason: 'blocked' });
  expect(state.player.at).toEqual(before); expect(state.rng).toEqual(rng);
  if (kind === 'crate') {
    state.level.rooms[0]!.design.decorations[0]!.opened = true;
    expect(resolveMove(state, 'E', true).reason).toBe('blocked');
  }
});
it.each<DecorationKind>(['bones', 'coinScatter'])('allows walking over flat %s', kind => {
  const state = createTwoRoomFixture();
  state.level.rooms[0]!.design.decorations.push({ id: 'flat', kind, at: { x: 6, y: 5 }, rotation: 0, variant: 0, scale: 1 });
  expect(resolveMove(state, 'E', true).resolved).toBe(true);
});
it('can approach and automatically loot a chest without entering its occupied tile', () => {
  const state = createTwoRoomFixture(); state.level.monsterOrder = []; delete state.entities.e1;
  state.level.rooms[0]!.design.decorations.push({ id: 'chest', kind: 'crate', at: { x: 7, y: 5 }, rotation: 0, variant: 0, scale: 1 });
  const game = new GameSession(state);
  game.submit({ expectedRevision: 0, action: { type: 'move', direction: 'E', pickup: true } });
  expect(game.exportState().player.at).toEqual({ x: 6, y: 5 });
  expect(game.exportState().player.gold).toBeGreaterThan(0);
  expect(game.submit({ expectedRevision: 1, action: { type: 'move', direction: 'E', pickup: true } })).toMatchObject({ consumedSlot: false, reason: 'blocked' });
});
it('keeps generated stairs, loot and spawn points clear and all existing routes connected', () => {
  for (const depth of [1, 10, 26]) for (const seed of [1, 12, 73, 12345, 8080]) {
    const content = generateLevelContent(seed, depth), level = content.level;
    expect(canOccupyFloor(level, content.playerAt)).toBe(true);
    expect(canOccupyFloor(level, level.stairs)).toBe(true);
    for (const entity of Object.values(content.entities)) {
      const at = entity.kind === 'monster' ? entity.at : entity.location.kind === 'floor' ? entity.location.at : null;
      if (at) expect(canOccupyFloor(level, at)).toBe(true);
    }
    const baseline = new Set([cellIndex(level, content.playerAt)]), baselineQueue = [content.playerAt];
    for (let cursor = 0; cursor < baselineQueue.length; cursor++) {
      const { x, y } = baselineQueue[cursor]!;
      for (const at of [{ x: x - 1, y }, { x: x + 1, y }, { x, y: y - 1 }, { x, y: y + 1 }]) {
        if (!supportsOccupant(level, at)) continue;
        const index = cellIndex(level, at); if (!baseline.has(index)) { baseline.add(index); baselineQueue.push(at); }
      }
    }
    const seen = new Set([cellIndex(level, content.playerAt)]), pending = [content.playerAt];
    for (let cursor = 0; cursor < pending.length; cursor++) {
      const { x, y } = pending[cursor]!;
      for (const at of [{ x: x - 1, y }, { x: x + 1, y }, { x, y: y - 1 }, { x, y: y + 1 }]) {
        if (!canOccupyFloor(level, at)) continue;
        const index = cellIndex(level, at); if (!seen.has(index)) { seen.add(index); pending.push(at); }
      }
    }
    for (let index = 0; index < level.tiles.length; index++) {
      const at = { x: index % level.width, y: Math.floor(index / level.width) };
      if (canOccupyFloor(level, at) && baseline.has(index)) expect(seen.has(index)).toBe(true);
    }
    expect(level.rooms.flatMap(room => room.design.decorations).some(prop => isSolidDecoration(prop.kind))).toBe(true);
  }
});

it('keeps solid props visible in a disclosed treasure room after its loot is gone', () => {
  const state = createTwoRoomFixture();
  state.level.rooms[0]!.design.theme = 'treasure';
  state.level.rooms[0]!.design.decorations.push({ id: 'remaining-column', kind: 'pillar', at: { x: 6, y: 5 }, rotation: 0, variant: 0, scale: 1 });
  expect(observe(state).decorations).toContainEqual(expect.objectContaining({ token: 'remaining-column' }));
});
