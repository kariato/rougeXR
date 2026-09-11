import type { Position } from './state';

export type Visibility = 'unknown' | 'remembered' | 'visible';

export interface CellAppearance {
  glyph: string;
  terrainLabel: string;
  featureLabel: string | null;
}

export interface ObservedCell {
  visibility: Visibility;
  appearance: CellAppearance | null;
}

export interface ObservedEntity {
  token: string;
  at: Position;
  appearance: string;
  label: string;
}

export interface PlayerObservation {
  revision: number;
  width: number;
  height: number;
  playerAt: Position;
  cells: ObservedCell[];
  entities: ObservedEntity[];
  status: { hp: number; maxHp: number; gold: number; depth: number };
}

export interface DebugCell {
  terrain: string;
  feature: string | null;
  secret: boolean;
  roomId: number | null;
  passageId: number | null;
}

export interface DebugEntity {
  id: string;
  kind: 'monster' | 'item';
  label: string;
  at: Position | null;
}

export interface DebugSnapshot {
  width: number;
  height: number;
  cells: DebugCell[];
  entities: DebugEntity[];
}
