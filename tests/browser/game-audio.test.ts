import { expect, it } from 'vitest';
import { GameAudio, soundCues } from '../../src/presentation/audio/game-audio';
import { createNewGame } from '../../src/engine/new-game';
import { observe } from '../../src/engine/perception/knowledge';
import type { PresentationEvent } from '../../src/engine/model/action';
const observation = observe(createNewGame(12345));
it('plays swings for misses and impact cues only for hits', () => {
  const attack: PresentationEvent = { type: 'visibleAttack', attackerToken: 'player', defenderToken: 'monster-e1',
    attackerAt: { x: 1, y: 1 }, defenderAt: { x: 2, y: 1 }, hit: false };
  expect(soundCues(observation, [attack], observation.status.hp)).toEqual(['swing']);
  expect(soundCues(observation, [{ ...attack, hit: true }], observation.status.hp)).toEqual(['swing', 'hit']);
});
it('handles player damage, death, loot, stairs and victory from observations', () => {
  const dead = { ...observation, status: { ...observation.status, hp: 0 } };
  expect(soundCues(dead, [], 1)).toEqual(['hurt', 'death']);
  expect(soundCues(observation, [{ type: 'levelViewReset' }, { type: 'message', text: '25 gold pieces.' },
    { type: 'message', text: 'You escaped with the Amulet of Yendor!' }], observation.status.hp)).toEqual(['stairs', 'pickup', 'victory']);
});
it('does not replay sounds when the same revision is rendered again', () => {
  const audio = new GameAudio();
  expect(audio.update(observation, [])).toEqual([]);
  const next = { ...observation, revision: observation.revision + 1 };
  expect(audio.update(next, [{ type: 'levelViewReset' }])).toEqual(['stairs']);
  expect(audio.update(next, [{ type: 'levelViewReset' }])).toEqual([]);
  audio.reset(); expect(audio.update(next, [{ type: 'levelViewReset' }])).toEqual([]);
});
