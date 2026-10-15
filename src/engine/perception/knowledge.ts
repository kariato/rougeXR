import { cellIndex, isPlayable, positionAt, tileAt } from '../grid';
import type { CellAppearance, PlayerObservation, Visibility } from '../model/observation';
import type { ItemState, Position, TileState, WorldState } from '../model/state';
import { IS_CONFUSED, IS_HELD, IS_HASTED, IS_LEVITATING, CAN_DETECT_MONSTERS, CAN_SEE_INVISIBLE, IS_BLIND, IS_HALLUCINATING, IS_INVISIBLE } from '../rules/flags';
import { canStepTerrain } from '../rules/movement';
import { observedDiscoveries, observedItemLabel } from '../identification';

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

/** Disclose corridor geometry from its doorway, without extending creature sight. */
function disclosedCorridor(state: WorldState): Set<number> {
  const disclosed = new Set<number>();
  if ((state.player.flags & IS_BLIND) !== 0) return disclosed;
  const start = cellIndex(state.level, state.player.at);
  const entrance = state.level.tiles[start];
  if (!entrance || entrance.secret || (entrance.terrain !== 'passage' && entrance.terrain !== 'door')
    || entrance.passageId === null) return disclosed;
  const pending = [start]; disclosed.add(start);
  while (pending.length) {
    const index = pending.pop()!;
    const at = positionAt(state.level, index);
    for (const next of [{ x: at.x + 1, y: at.y }, { x: at.x - 1, y: at.y },
      { x: at.x, y: at.y + 1 }, { x: at.x, y: at.y - 1 }]) {
      if (!isPlayable(state.level, next)) continue;
      const nextIndex = cellIndex(state.level, next);
      const tile = state.level.tiles[nextIndex]!;
      if (disclosed.has(nextIndex) || tile.secret || tile.passageId !== entrance.passageId
        || (tile.terrain !== 'passage' && tile.terrain !== 'door')) continue;
      disclosed.add(nextIndex); pending.push(nextIndex);
    }
  }
  // Disclose solid boundaries of the connected corridor too. These cells supply
  // geometry only; creature and item visibility still uses the ordinary look.
  for (const index of [...disclosed]) {
    const at = positionAt(state.level, index);
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
      const next = { x: at.x + dx, y: at.y + dy };
      if (!isPlayable(state.level, next)) continue;
      const tile = tileAt(state.level, next);
      if (tile.terrain === 'void' || tile.terrain === 'wallH' || tile.terrain === 'wallV')
        disclosed.add(cellIndex(state.level, next));
    }
  }
  return disclosed;
}

export function updateKnowledge(state: WorldState): void {
  if (state.knowledge.levelId !== state.level.id || state.knowledge.remembered.length !== state.level.tiles.length) {
    state.knowledge = { levelId: state.level.id, remembered: Array.from({ length: state.level.tiles.length }, () => null) };
  }
  const corridor = disclosedCorridor(state);
  for (let index = 0; index < state.level.tiles.length; index++) {
    const at = positionAt(state.level, index);
    if (corridor.has(index) || isPositionVisible(state, at)) state.knowledge.remembered[index] = appearanceFor(state.level.tiles[index]!);
  }
}

export function observe(state: WorldState): PlayerObservation {
  const corridor = disclosedCorridor(state);
  const revealedTreasureRooms = new Set(Object.values(state.entities).flatMap(entity => {
    if (entity.kind !== 'item' || entity.location.kind !== 'floor' || !isPositionVisible(state, entity.location.at)) return [];
    const roomId = state.level.tiles[cellIndex(state.level, entity.location.at)]?.roomId; return roomId === null || roomId === undefined ? [] : [roomId];
  }));
  const cells = state.level.tiles.map((tile, index) => {
    const visible = corridor.has(index) || isPositionVisible(state, positionAt(state.level, index));
    const remembered = state.knowledge.remembered[index] ?? null;
    const visibility: Visibility = visible ? 'visible' : remembered ? 'remembered' : 'unknown';
    const room = tile.roomId === null ? null : state.level.rooms.find(candidate => candidate.id === tile.roomId) ?? null;
    const observedTheme = room?.design.theme === 'treasure' && !revealedTreasureRooms.has(room.id) ? room.design.baseTheme : room?.design.theme;
    return { visibility, appearance: visible ? appearanceFor(tile) : remembered ? { ...remembered } : null,
      visualRegion: visibility === 'unknown' || !room || !observedTheme ? null : { token: room.design.token, theme: observedTheme,
        condition: room.design.condition, dark: room.dark } };
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
    if (!isPositionVisible(state, at)) return [];
    return [{ token: `item-${entity.id}`, at: { ...at }, appearance: hallucinating ? cosmicGlyph(state, entity.id, false) : itemGlyph(entity),
      label: hallucinating ? 'cosmic object' : observedItemLabel(state, entity) }];
  });
  const inventory = state.player.packOrder.map(id => {
    const item = state.entities[id]; if (item?.kind !== 'item') throw new Error('Invalid player pack');
    const equippedSlot = Object.entries(state.player.equipment).find(([, equipped]) => equipped === id)?.[0] ?? null;
    return { token: item.id, label: observedItemLabel(state, item), quantity: item.quantity, category: item.category, equippedSlot,
      knownCursed: (item.flags & 0o1) !== 0 && (item.curseKnown === true || (item.flags & 0o2) !== 0),
      assetKey: item.category === 'weapon' ? item.definitionId : null };
  });
  const decorations = state.level.rooms.flatMap(room => room.design.decorations.flatMap(decoration => {
    const cell = cells[cellIndex(state.level, decoration.at)];
    return cell?.visibility === 'unknown' ? [] : [{ token: decoration.id, at: { ...decoration.at }, kind: decoration.kind,
      ...(decoration.kind === 'crate' ? { opened: decoration.opened ?? false } : {}),
      rotation: decoration.rotation, variant: decoration.variant, scale: decoration.scale,
      theme: room.design.theme === 'treasure' && !revealedTreasureRooms.has(room.id) ? room.design.baseTheme : room.design.theme }];
  }));
  const strengthModifier = [state.player.equipment.leftRing, state.player.equipment.rightRing].reduce<number>((sum, id) => {
    const ring = id ? state.entities[id] : null;
    return sum + (ring?.kind === 'item' && ring.category === 'ring' && ring.definitionId === 'ring.add-strength' ? ring.magnitude : 0);
  }, 0);
  const maximumStrength = Math.max(3, Math.min(31, state.player.maximumStrength + strengthModifier));
  return { discoveries: observedDiscoveries(state),
    ...(state.timing.status === 'playing' ? {} : { ending: {
      outcome: state.timing.status, cause: state.timing.status === 'won' ? 'You escaped with the Amulet of Yendor!' : state.timing.deathCause ?? 'An unknown dungeon danger',
      depth: state.sourceState.maximumDepth, gold: state.player.gold, experience: state.player.stats.experience,
      turns: state.timing.tick, score: state.player.gold + state.player.stats.experience + (state.timing.status === 'won' ? 1000 : 0),
    } }), revision: state.timing.revision, width: state.level.width, height: state.level.height,
    playerAt: { ...state.player.at }, cells, entities, decorations,
    status: { hp: state.player.stats.hp, maxHp: state.player.stats.maxHp, gold: state.player.gold, depth: state.level.depth,
      hungerStage: state.timing.hungerStage, strength: state.player.stats.strength, maximumStrength, conditions: [
        [IS_BLIND, 'Blind'], [IS_CONFUSED, 'Confused'], [IS_HELD, 'Held'], [IS_LEVITATING, 'Levitating'],
        [IS_HALLUCINATING, 'Hallucinating'], [IS_HASTED, 'Hasted'],
      ].filter(([flag]) => (state.player.flags & (flag as number)) !== 0).map(([, label]) => label as string)
        .concat(state.timing.noMove > 0 ? ['Trapped'] : [])
        .concat(state.player.poisonWeakened && state.player.stats.strength < maximumStrength ? ['Poisoned'] : []) }, inventory, pendingDecision: state.pendingDecision?.kind ?? null };
}

function cosmicGlyph(state: WorldState, id: string, monster: boolean): string {
  let hash = state.timing.tick + 1; for (const character of id) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  const glyphs = monster ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' : '!?=:)]/%*'; return glyphs[Math.abs(hash) % glyphs.length]!;
}

function itemGlyph(item: ItemState): string {
  return ({ gold: '*', potion: '!', scroll: '?', food: ':', weapon: ')', armor: ']', amulet: ',', ring: '=', stick: '/' } as const)[item.category];
}
