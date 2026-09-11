import { cellIndex, positionAt } from '../grid';
import type { DebugSnapshot, PlayerObservation } from '../model/observation';
import type { WorldState } from '../model/state';
import { observe } from './knowledge';

/**
 * Temporary fixture visibility: the player's room is visible and passage 0 is remembered.
 * This is deliberately replaced by source-compatible perception in Phase 5.
 */
export function observeFixture(state: WorldState): PlayerObservation {
  return observe(state);
}

/** Detached, read-only input for the separately marked debug layer. */
export function debugFixtureSnapshot(state: WorldState): DebugSnapshot {
  return {
    width: state.level.width,
    height: state.level.height,
    cells: state.level.tiles.map(tile => ({
      terrain: tile.terrain,
      feature: tile.feature?.kind === 'stairs' ? 'stairs' : tile.feature?.kind === 'trap' ? `${tile.feature.trap} trap` : null,
      secret: tile.secret,
      roomId: tile.roomId,
      passageId: tile.passageId,
    })),
    entities: Object.values(state.entities).map(entity => ({
      id: entity.id,
      kind: entity.kind,
      label: entity.definitionId,
      at: entity.kind === 'monster'
        ? { ...entity.at }
        : entity.location.kind === 'floor' ? { ...entity.location.at } : null,
    })),
  };
}

export function describeObservedCell(observation: PlayerObservation, index: number): string[] {
  const cell = observation.cells[index];
  if (!cell) return ['Outside dungeon'];
  const at = positionAt(observation, index);
  const lines = [`Cell ${at.x}, ${at.y}`, `Visibility: ${cell.visibility}`];
  if (cell.appearance) {
    lines.push(`Terrain: ${cell.appearance.terrainLabel}`);
    if (cell.appearance.featureLabel) lines.push(`Feature: ${cell.appearance.featureLabel}`);
  }
  for (const entity of observation.entities.filter(candidate => candidate.at.x === at.x && candidate.at.y === at.y)) {
    lines.push(`Visible entity: ${entity.label}`);
  }
  if (at.x === observation.playerAt.x && at.y === observation.playerAt.y) lines.push('Player');
  return lines;
}

export function describeDebugCell(snapshot: DebugSnapshot, index: number): string[] {
  const cell = snapshot.cells[index];
  if (!cell) return [];
  const at = positionAt(snapshot, index);
  const lines = [`Debug terrain: ${cell.terrain}`];
  if (cell.feature) lines.push(`Debug feature: ${cell.feature}`);
  if (cell.roomId !== null) lines.push(`Room: ${cell.roomId}`);
  if (cell.passageId !== null) lines.push(`Passage: ${cell.passageId}`);
  for (const entity of snapshot.entities.filter(candidate => candidate.at?.x === at.x && candidate.at.y === at.y)) {
    lines.push(`Debug entity: ${entity.id} (${entity.label})`);
  }
  return lines;
}
