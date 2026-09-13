import { cellIndex, isPlayable, positionAt, tileAt } from '../grid';
import type { CellAppearance, PlayerObservation, Visibility } from '../model/observation';
import type { ItemState, Position, TileState, WorldState } from '../model/state';
import { CAN_DETECT_MONSTERS, CAN_SEE_INVISIBLE, IS_BLIND, IS_HALLUCINATING, IS_INVISIBLE } from '../rules/flags';
import { canStepTerrain } from '../rules/movement';
import { observedItemLabel } from '../identification';

const GLYPHS: Record<TileState['terrain'], string> = {
  void: ' ', floor: '.', wallH: '─', wallV: '│', door: '+', passage: '#',
};

export function appearanceFor(tile: TileState): CellAppearance {
  const featureLabel = tile.feature?.kind === 'stairs' ? 'stairs'
    : tile.feature?.kind === 'trap' && tile.feature.revealed ? `${tile.feature.trap} trap` : null;
  return { glyph: featureLabel === 'stairs' ? '%' : featureLabel?.endsWith('trap') ? '^' : GLYPHS[tile.terrain],
    terrainLabel: tile.terrain, featureLabel };
}

/** Source-shaped ordinary visibility: lit current room plus the local look() neighborhood. */
export function isPositionVisible(state: WorldState, at: Position): boolean {
  if (!isPlayable(state.level, at)) return false;
  const player = state.player.at;
  if (at.x === player.x && at.y === player.y) return true;
  if ((state.player.flags & IS_BLIND) !== 0) return false;
  const room = state.player.roomId === null ? null : state.level.rooms.find(candidate => candidate.id === state.player.roomId);
  if (room && !room.dark && tileAt(state.level, at).roomId === room.id) return true;
  const dx = Math.abs(at.x - player.x); const dy = Math.abs(at.y - player.y);
  if (dx > 1 || dy > 1) return false;
  const source = tileAt(state.level, player); const target = tileAt(state.level, at);
  const sourcePass = source.terrain === 'passage'; const targetPass = target.terrain === 'passage';
  if (source.terrain !== 'door' && target.terrain !== 'door' && sourcePass !== targetPass) return false;
  if (dx === 1 && dy === 1 && (sourcePass || source.terrain === 'door') && (targetPass || target.terrain === 'door')) {
    return canStepTerrain(tileAt(state.level, { x: player.x, y: at.y }).terrain)
      || canStepTerrain(tileAt(state.level, { x: at.x, y: player.y }).terrain);
  }
  return true;
}

export function updateKnowledge(state: WorldState): void {
  if (state.knowledge.levelId !== state.level.id || state.knowledge.remembered.length !== state.level.tiles.length) {
    state.knowledge = { levelId: state.level.id, remembered: Array.from({ length: state.level.tiles.length }, () => null) };
  }
  for (let index = 0; index < state.level.tiles.length; index++) {
    const at = positionAt(state.level, index);
    if (isPositionVisible(state, at)) state.knowledge.remembered[index] = appearanceFor(state.level.tiles[index]!);
  }
}

export function observe(state: WorldState): PlayerObservation {
  const cells = state.level.tiles.map((tile, index) => {
    const visible = isPositionVisible(state, positionAt(state.level, index));
    const remembered = state.knowledge.remembered[index] ?? null;
    const visibility: Visibility = visible ? 'visible' : remembered ? 'remembered' : 'unknown';
    return { visibility, appearance: visible ? appearanceFor(tile) : remembered ? { ...remembered } : null };
  });
  const detecting = (state.player.flags & CAN_DETECT_MONSTERS) !== 0;
  const hallucinating = (state.player.flags & IS_HALLUCINATING) !== 0;
  const entities = Object.values(state.entities).flatMap(entity => {
    const at = entity.kind === 'monster' ? entity.at : entity.location.kind === 'floor' ? entity.location.at : null;
    if (!at) return [];
    if (entity.kind === 'monster') {
      const ordinarilyVisible = isPositionVisible(state, at)
        && ((entity.flags & IS_INVISIBLE) === 0 || (state.player.flags & CAN_SEE_INVISIBLE) !== 0);
      if (!ordinarilyVisible && !detecting) return [];
      return [{ token: `monster-${entity.id}`, at: { ...at }, appearance: hallucinating ? cosmicGlyph(state, entity.id, true) : entity.disguise ?? 'M',
        label: hallucinating ? 'cosmic creature' : ordinarilyVisible ? (entity.disguise ?? entity.definitionId) : 'detected monster' }];
    }
    if (cells[cellIndex(state.level, at)]?.visibility !== 'visible') return [];
    return [{ token: `item-${entity.id}`, at: { ...at }, appearance: hallucinating ? cosmicGlyph(state, entity.id, false) : itemGlyph(entity),
      label: hallucinating ? 'cosmic object' : observedItemLabel(state, entity) }];
  });
  const inventory = state.player.packOrder.map(id => {
    const item = state.entities[id]; if (item?.kind !== 'item') throw new Error('Invalid player pack');
    const equippedSlot = Object.entries(state.player.equipment).find(([, equipped]) => equipped === id)?.[0] ?? null;
    return { token: item.id, label: observedItemLabel(state, item), quantity: item.quantity, category: item.category, equippedSlot };
  });
  return { revision: state.timing.revision, width: state.level.width, height: state.level.height,
    playerAt: { ...state.player.at }, cells, entities,
    status: { hp: state.player.stats.hp, maxHp: state.player.stats.maxHp, gold: state.player.gold, depth: state.level.depth,
      hungerStage: state.timing.hungerStage }, inventory, pendingDecision: state.pendingDecision?.kind ?? null };
}

function cosmicGlyph(state: WorldState, id: string, monster: boolean): string {
  let hash = state.timing.tick + 1; for (const character of id) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  const glyphs = monster ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' : '!?=:)]/%*'; return glyphs[Math.abs(hash) % glyphs.length]!;
}

function itemGlyph(item: ItemState): string {
  return ({ gold: '*', potion: '!', scroll: '?', food: ':', weapon: ')', armor: ']', amulet: ',', ring: '=', stick: '/' } as const)[item.category];
}
