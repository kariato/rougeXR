import { expect, it } from 'vitest';
import { createTwoRoomFixture } from '../../src/debug/fixtures';
import { observe } from '../../src/engine/perception/knowledge';
import { observedItemLabel, readableItemName } from '../../src/engine/identification';
import { createNewGame } from '../../src/engine/new-game';
import { GameSession } from '../../src/engine/session';
import { startDaemon } from '../../src/engine/scheduler';
import { parseSave, serializeSave, restoreGame } from '../../src/persistence/save';

it('persists a fatal cause and deepest depth through save and restore', () => {
  const state = createTwoRoomFixture();
  state.sourceState.maximumDepth = 8; state.player.gold = 123; state.player.stats.experience = 42;
  state.timing.foodLeft = -851; startDaemon(state.timing.scheduler, 'stomach', 0, 'after');
  const game = new GameSession(state);
  game.submit({ expectedRevision: 0, action: { type: 'rest' } });
  const ending = observe(game.exportState()).ending;
  expect(ending).toMatchObject({ outcome: 'dead', cause: 'starvation', depth: 8, gold: 123, experience: 42, score: 165 });
  const saved = parseSave(serializeSave(game.exportState())); if (!saved.ok) throw new Error('Invalid save');
  expect(observe(restoreGame(saved.value.state).exportState()).ending).toEqual(ending);
});
it('gives victory its own bonus and lets old terminal saves omit cause', () => {
  const state = createTwoRoomFixture(); state.timing.status = 'won'; state.player.gold = 25; state.player.stats.experience = 50;
  expect(observe(state).ending).toMatchObject({ outcome: 'won', score: 1075 });
  state.timing.status = 'dead'; state.player.stats.hp = 0;
  expect(observe(state).ending?.cause).toBe('An unknown dungeon danger');
});
it('uses readable equipment names while preserving custom labels and unknown magic', () => {
  const state = createTwoRoomFixture();
  expect(readableItemName('weapon.mace')).toBe('Mace');
  expect(readableItemName('armor.chain')).toBe('Chain mail');
  expect(readableItemName('amulet.yendor')).toBe('Amulet of Yendor');
  const item = Object.values(createNewGame(12345).entities).find(item => item.kind === 'item' && item.definitionId === 'weapon.mace')!;
  if (item.kind !== 'item') throw new Error(); expect(observedItemLabel(state, item)).toBe('Mace'); item.label = 'My trusty blade';
  expect(observedItemLabel(state, item)).toBe('My trusty blade');
});
it('discloses only learned magic, in all four categories, including consumed items', () => {
  const state = createTwoRoomFixture();
  const ids = ['potion.healing', 'scroll.magic-mapping', 'ring.protection', 'stick.fire'];
  for (const entry of state.identification) { entry.known = ids.includes(entry.definitionId); entry.called = 'a guess'; }
  const before = JSON.stringify(state);
  const observation = observe(state);
  expect(observation.discoveries?.map(entry => entry.category)).toEqual(['potion', 'scroll', 'ring', 'stick']);
  expect(observation.discoveries?.map(entry => entry.name)).toEqual(['Potion of healing', 'Scroll of magic mapping', 'Ring of protection', expect.stringMatching(/^(Wand|Staff) of fire$/)]);
  expect(JSON.stringify(state)).toBe(before);
});
