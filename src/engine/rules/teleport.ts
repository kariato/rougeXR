import { buildIndexes } from '../entities';
import { cellIndex, supportsOccupant } from '../grid';
import type { RawEventInput } from '../model/action';
import type { WorldState } from '../model/state';
import { rnd } from '../random';
import { IS_HELD, IS_RUNNING } from './flags';

export function teleportPlayer(state: WorldState, emit: (event: RawEventInput) => void): boolean {
  const from = { ...state.player.at }; const fromRoom = state.player.roomId; const monsters = buildIndexes(state).monsters;
  for (let attempt = 0; attempt < 10000; attempt++) {
    let room = state.level.rooms[rnd(state.rng, state.level.rooms.length)]!;
    while (room.kind === 'gone') room = state.level.rooms[rnd(state.rng, state.level.rooms.length)]!;
    if (room.width <= 2 || room.height <= 2) continue;
    const at = { x: room.origin.x + rnd(state.rng, room.width - 2) + 1, y: room.origin.y + rnd(state.rng, room.height - 2) + 1 };
    if (!supportsOccupant(state.level, at) || monsters.has(cellIndex(state.level, at))) continue;
    state.player.at = at; state.player.roomId = state.level.tiles[cellIndex(state.level, at)]!.roomId;
    state.player.flags &= ~(IS_HELD | IS_RUNNING); state.timing.noMove = 0;
    emit({ type: 'actorMoved', actorId: 'player', from, to: { ...at } }); return state.player.roomId !== fromRoom;
  }
  throw new Error('Unable to find teleport destination');
}
