import type { PlayerObservation, Visibility } from '../../engine/model/observation';
import type { RoomTheme } from '../../engine/model/state';

export interface PrimitiveCell {
  x: number;
  z: number;
  kind: 'floor' | 'passage' | 'wall' | 'door';
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
    const terrain = cell.appearance.terrainLabel;
    if (Math.abs(x - observation.playerAt.x) + Math.abs(z - observation.playerAt.y) > radius
      && !(cell.visibility === 'visible' && (terrain === 'passage' || terrain === 'door'))) continue;
    result.push({ x, z, kind: terrain === 'wallH' || terrain === 'wallV' ? 'wall' : terrain === 'door' ? 'door' : terrain === 'passage' ? 'passage' : 'floor', visibility: cell.visibility,
      theme: cell.visualRegion?.theme ?? 'dungeon', condition: cell.visualRegion?.condition ?? 0, dark: cell.visualRegion?.dark ?? false });
  }
  return result;
}

export interface CorridorWall { x: number; z: number; axis: 'x' | 'z'; length?: number; theme: RoomTheme; condition: 0 | 1 | 2; dark: boolean; remembered: boolean }

/** Close the disclosed sides of narrow passage cells; unknown level topology is never inspected. */
export function buildCorridorWalls(cells: readonly PrimitiveCell[]): CorridorWall[] {
  const byPosition = new Map(cells.map(cell => [`${cell.x},${cell.z}`, cell]));
  const connected = (x: number, z: number): boolean => {
    const kind = byPosition.get(`${x},${z}`)?.kind;
    return kind === 'passage' || kind === 'door';
  };
  const walls: CorridorWall[] = [];
  for (const cell of cells) {
    if (cell.kind !== 'passage') continue;
    const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;
    const connectedAxes = new Set(directions.filter(([dx, dz]) => connected(cell.x + dx, cell.z + dz))
      .map(([dx]) => dx === 0 ? 'z' : 'x'));
    const bend = directions.filter(([dx, dz]) => connected(cell.x + dx, cell.z + dz)).length === 2 && connectedAxes.size === 2;
    for (const [dx, dz] of directions) {
      if (connected(cell.x + dx, cell.z + dz)) continue;
      const neighborKnown = byPosition.has(`${cell.x + dx},${cell.z + dz}`);
      const sideAxis = dx === 0 ? 'z' : 'x';
      // An absent cell may be the still-undisclosed continuation ahead. Infer only
      // perpendicular side walls from a single known corridor axis; never cap fog.
      if (!neighborKnown && !bend && (connectedAxes.size !== 1 || connectedAxes.has(sideAxis))) continue;
      // At a bend, paint only the outside half of an undisclosed side. The
      // remaining half stays open in case it reveals a branching passage.
      const cornerReturn = !neighborKnown && bend;
      const otherMissing = directions.find(([otherDx, otherDz]) => (otherDx !== dx || otherDz !== dz)
        && !connected(cell.x + otherDx, cell.z + otherDz));
      walls.push({ x: cell.x + dx * .47 + (cornerReturn ? (otherMissing?.[0] ?? 0) * .25 : 0),
        z: cell.z + dz * .47 + (cornerReturn ? (otherMissing?.[1] ?? 0) * .25 : 0),
        axis: dx === 0 ? 'x' : 'z', ...(cornerReturn ? { length: .5 } : {}), theme: cell.theme,
        condition: cell.condition, dark: cell.dark, remembered: cell.visibility === 'remembered' });
    }
  }
  return walls;
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
