import type { PlayerObservation, Visibility } from '../../engine/model/observation';
import type { RoomTheme } from '../../engine/model/state';

export interface PrimitiveCell {
  x: number;
  z: number;
  kind: 'floor' | 'wall' | 'door';
  visibility: Exclude<Visibility, 'unknown'>;
  theme: RoomTheme;
  condition: 0 | 1 | 2;
  dark: boolean;
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
    result.push({ x, z, kind: terrain === 'wallH' || terrain === 'wallV' ? 'wall' : terrain === 'door' ? 'door' : 'floor', visibility: cell.visibility,
      theme: cell.visualRegion?.theme ?? 'dungeon', condition: cell.visualRegion?.condition ?? 0, dark: cell.visualRegion?.dark ?? false });
  }
  return result;
}

/** Only currently visible wall torches may emit local light; nearest four win. */
export function selectLitTorches(observation: PlayerObservation, activeCells: ReadonlySet<string>, reserved: ReadonlySet<string>, limit = 4): Set<string> {
  const candidates = observation.decorations.filter(decoration => {
    if (decoration.kind !== 'torch') return false;
    const key = `${decoration.at.x},${decoration.at.y}`;
    const cell = observation.cells[decoration.at.y * observation.width + decoration.at.x];
    return activeCells.has(key) && !reserved.has(key) && cell?.visibility === 'visible';
  });
  candidates.sort((a, b) => {
    const distance = (at: typeof a.at): number => Math.abs(at.x - observation.playerAt.x) + Math.abs(at.y - observation.playerAt.y);
    return distance(a.at) - distance(b.at) || a.token.localeCompare(b.token);
  });
  return new Set(candidates.slice(0, limit).map(decoration => decoration.token));
}
