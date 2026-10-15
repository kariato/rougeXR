import { expect, it } from 'vitest';
import { createTwoRoomFixture } from '../../src/debug/fixtures';
import { GameSession } from '../../src/engine/session';
import { parseSave, serializeSave, restoreGame } from '../../src/persistence/save';
import { observe } from '../../src/engine/perception/knowledge';

function setup() {
  const state = createTwoRoomFixture();
  state.level.rooms[0]!.design.decorations.push({ id: 'test-chest', kind: 'crate', at: { x: 6, y: 5 }, rotation: 0, variant: 0, scale: 1 });
  state.level.monsterOrder = [];
  delete state.entities.e1;
  return new GameSession(state);
}
it('awards deterministic gold once, advances time, and preserves empty chests in saves', () => {
  const session = setup(), replay = setup();
  const request = { expectedRevision: 0, action: { type: 'openChest' as const, chestId: 'test-chest' } };
  const result = session.submit(request);
  replay.submit(request);
  expect(result.status).toBe('resolved');
  expect(result.consumedSlot).toBe(true);
  expect(result.events).toContainEqual(expect.objectContaining({ type: 'message', text: expect.stringContaining('Contents:') }));
  const state = session.exportState();
  expect(state.player.gold).toBeGreaterThan(0);
  expect(replay.exportState()).toEqual(state);
  expect(observe(state).decorations.find(d => d.token === 'test-chest')?.opened).toBe(true);
  const saved = parseSave(serializeSave(state));
  expect(saved.ok).toBe(true);
  if (!saved.ok) throw new Error(JSON.stringify(saved.errors));
  const restored = restoreGame(saved.value.state);
  const second = restored.submit({ ...request, expectedRevision: state.timing.revision });
  expect(second.consumedSlot).toBe(false);
  expect(restored.exportState().player.gold).toBe(state.player.gold);
  expect(restored.exportState().rng).toEqual(state.rng);
});
it('rejects missing and distant chests without awarding gold', () => {
  const session = setup();
  expect(session.submit({ expectedRevision: 0, action: { type: 'openChest', chestId: 'missing' } }).status).toBe('rejected');
  const state = session.exportState(); state.player.at = { x: 9, y: 5 };
  const distant = new GameSession(state);
  expect(distant.submit({ expectedRevision: state.timing.revision, action: { type: 'openChest', chestId: 'test-chest' } }).status).toBe('rejected');
  expect(distant.exportState().player.gold).toBe(0);
});

it('opens adjacent chests during movement, reports gold, and never collects twice', () => {
  const session = setup();
  const first = session.submit({ expectedRevision: 0, action: { type: 'move', direction: 'N', pickup: true } });
  expect(first).toMatchObject({ consumedSlot: true, ticksAdvanced: 1 });
  expect(first.events).toContainEqual(expect.objectContaining({ type: 'message', text: expect.stringContaining('Contents:') }));
  const gold = session.exportState().player.gold;
  expect(gold).toBeGreaterThan(0);
  expect(observe(session.exportState()).decorations.find(d => d.token === 'test-chest')?.opened).toBe(true);
  session.submit({ expectedRevision: 1, action: { type: 'move', direction: 'S', pickup: true } });
  expect(session.exportState().player.gold).toBe(gold);
  const parsed = parseSave(serializeSave(session.exportState())); if (!parsed.ok) throw new Error('Invalid save');
  const restored = restoreGame(parsed.value.state);
  restored.submit({ expectedRevision: 2, action: { type: 'move', direction: 'N', pickup: true } });
  expect(restored.exportState().player.gold).toBe(gold);
});

it('does not open distant chests or collect merely by resting beside them', () => {
  const session = setup();
  session.submit({ expectedRevision: 0, action: { type: 'rest' } });
  expect(session.exportState().player.gold).toBe(0);
  session.submit({ expectedRevision: 1, action: { type: 'move', direction: 'W', pickup: true } });
  expect(session.exportState().player.gold).toBe(0);
});

it('does not reach diagonally through a solid corner', () => {
  const state = setup().exportState();
  state.level.tiles[4 * state.level.width + 6]!.terrain = 'wallH';
  const session = new GameSession(state);
  session.submit({ expectedRevision: 0, action: { type: 'move', direction: 'N', pickup: true } });
  expect(session.exportState().player.gold).toBe(0);
});
