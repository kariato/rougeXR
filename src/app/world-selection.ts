import { createKestrelEncounterFixture, createTwoRoomFixture } from '../debug/fixtures';
import type { WorldState } from '../engine/model/state';
import { createNewGame } from '../engine/new-game';

export type WorldMode = 'generated' | 'kestrel' | 'rooms';

export function parseSeed(value: string): number {
  if (value.trim() === '') throw new Error('Enter a seed from 0 to 4294967295.');
  const seed = Number(value);
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new Error('Enter a seed from 0 to 4294967295.');
  }
  return seed;
}

export function createSelectedWorld(mode: WorldMode, seed: number): WorldState {
  switch (mode) {
    case 'generated': return createNewGame(seed);
    case 'kestrel': return createKestrelEncounterFixture(seed);
    case 'rooms': return createTwoRoomFixture(seed);
  }
}
