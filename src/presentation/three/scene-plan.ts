import type { PlayerObservation, Visibility } from '../../engine/model/observation';

export interface PrimitiveCell {
  x: number;
  z: number;
  kind: 'floor' | 'wall' | 'door';
  visibility: Exclude<Visibility, 'unknown'>;
}

/** Converts only disclosed observation cells; authoritative level state is never accepted here. */
export function buildPrimitiveCells(observation: PlayerObservation, radius = Number.POSITIVE_INFINITY): PrimitiveCell[] {
  const result: PrimitiveCell[] = [];
  for (let index = 0; index < observation.cells.length; index++) {
    const cell = observation.cells[index];
    if (!cell || cell.visibility === 'unknown' || !cell.appearance) continue;
    const x = index % observation.width;
    const z = Math.floor(index / observation.width);
    if (Math.abs(x - observation.playerAt.x) + Math.abs(z - observation.playerAt.y) > radius) continue;
    const terrain = cell.appearance.terrainLabel;
    result.push({ x, z, kind: terrain === 'wallH' || terrain === 'wallV' ? 'wall' : terrain === 'door' ? 'door' : 'floor', visibility: cell.visibility });
  }
  return result;
}
