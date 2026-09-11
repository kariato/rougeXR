import { allocateId } from '../engine/entities';
import { cellIndex, GRID_HEIGHT, GRID_WIDTH } from '../engine/grid';
import type { CombatStats, TileState, WorldState } from '../engine/model/state';
import { createRandom, rnd } from '../engine/random';

/** Synthetic debug data, not Rogue generation or a source-balanced encounter. */
export function createTwoRoomFixture(seed = 12345): WorldState {
  const stats = (): CombatStats => ({ strength: 10, experience: 0, level: 1, armorClass: 10, hp: 10, maxHp: 10, damage: [{ count: 1, sides: 4 }] });
  const state: WorldState = {
    seed, rng: createRandom(seed), nextEntitySerial: 1, entities: {},
    timing: { revision: 0, actionSequence: 0, tick: 0, status: 'playing', noCommand: 0, noMove: 0, hasted: false,
      scheduler: { slots: Array.from({ length: 20 }, () => null) }, cycle: { phase: 'begin', slotsRemaining: 0 } },
    player: { at: { x: 5, y: 5 }, stats: stats(), flags: 0, packOrder: [], roomId: 0, gold: 0,
      equipment: { weapon: null, armor: null, leftRing: null, rightRing: null } },
    level: { id: 1, depth: 1, width: GRID_WIDTH, height: GRID_HEIGHT,
      tiles: Array.from({ length: GRID_WIDTH * GRID_HEIGHT }, (): TileState => ({ terrain: 'void', secret: false, feature: null, roomId: null, passageId: null })),
      rooms: Array.from({ length: 9 }, (_, id) => ({ id, origin: { x: 0, y: 1 }, width: 1, height: 1, kind: 'gone', dark: false, exits: [], goldTarget: null })),
      passages: [], stairs: { x: 25, y: 5 }, monsterOrder: [], floorObjectOrder: [] }
  };
  for (const [id, left] of [[0, 2], [1, 20]] as const) {
    state.level.rooms[id] = { id, origin: { x: left, y: 2 }, width: 10, height: 8, kind: 'room', dark: false,
      exits: [{ x: id === 0 ? 11 : 20, y: 5 }], goldTarget: null };
    for (let y = 2; y < 10; y++) for (let x = left; x < left + 10; x++) {
      state.level.tiles[cellIndex(state.level, { x, y })] = { terrain: y === 2 || y === 9 ? 'wallH' : x === left || x === left + 9 ? 'wallV' : 'floor', secret: false, feature: null, roomId: id, passageId: null };
    }
  }
  const cells: number[] = [];
  for (let x = 11; x <= 20; x++) {
    const i = cellIndex(state.level, { x, y: 5 });
    state.level.tiles[i] = { terrain: x === 11 || x === 20 ? 'door' : 'passage', secret: false, feature: null,
      roomId: x === 11 ? 0 : x === 20 ? 1 : null, passageId: 0 };
    cells.push(i);
  }
  state.level.passages.push({ id: 0, cells });
  state.level.tiles[cellIndex(state.level, state.level.stairs)]!.feature = { kind: 'stairs' };
  const monsterId = allocateId(state);
  const objectId = allocateId(state);
  state.entities[monsterId] = { kind: 'monster', id: monsterId, definitionId: 'fixture.monster', at: { x: 23, y: 5 }, stats: stats(), flags: 0, slowTurn: false, target: null, disguise: null, roomId: 1, packOrder: [] };
  state.entities[objectId] = { kind: 'item', id: objectId, definitionId: 'fixture.gold', category: 'gold', location: { kind: 'floor', levelId: 1, at: { x: 23, y: 5 } }, quantity: rnd(state.rng, 10) + 1, flags: 0, group: 0, label: null };
  state.level.monsterOrder.push(monsterId);
  state.level.floorObjectOrder.push(objectId);
  return state;
}
