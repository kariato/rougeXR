import type { DecorationKind, LevelState, Position, TileState } from './model/state';

export const GRID_WIDTH = 80;
export const GRID_HEIGHT = 24;
type Dimensions = Pick<LevelState, 'width' | 'height'>;
export function inBounds(grid: Dimensions, at: Position): boolean {
  return Number.isInteger(at.x) && Number.isInteger(at.y)
    && at.x >= 0 && at.x < grid.width && at.y >= 0 && at.y < grid.height;
}
export function isPlayable(grid: Dimensions, at: Position): boolean {
  return inBounds(grid, at) && at.y > 0 && at.y < grid.height - 1;
}
export function cellIndex(grid: Dimensions, at: Position): number {
  if (!inBounds(grid, at)) throw new RangeError('Position outside grid');
  return at.y * grid.width + at.x;
}
export function positionAt(grid: Dimensions, index: number): Position {
  if (!Number.isInteger(index) || index < 0 || index >= grid.width * grid.height) throw new RangeError('Invalid cell index');
  return { x: index % grid.width, y: Math.floor(index / grid.width) };
}
export function tileAt(level: LevelState, at: Position): TileState {
  const tile = level.tiles[cellIndex(level, at)];
  if (!tile) throw new Error('Missing tile');
  return tile;
}
/** Structural occupancy only; source-specific movement legality is Phase 4. */
export function supportsOccupant(level: LevelState, at: Position): boolean {
  if (!isPlayable(level, at)) return false;
  return ['floor', 'door', 'passage'].includes(tileAt(level, at).terrain);
}

export function isSolidDecoration(kind: DecorationKind): boolean {
  return ['crate', 'rubble', 'pillar', 'urn', 'mushroom'].includes(kind);
}
export function solidDecorationAt(level: LevelState, at: Position): boolean {
  return level.rooms.some(room => room.design.decorations.some(prop =>
    isSolidDecoration(prop.kind) && prop.at.x === at.x && prop.at.y === at.y));
}
export function canOccupyFloor(level: LevelState, at: Position): boolean {
  return supportsOccupant(level, at) && !solidDecorationAt(level, at);
}
