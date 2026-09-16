import type { DecorationKind, Position, RoomTheme } from './state';

export type Visibility = 'unknown' | 'remembered' | 'visible';

export interface CellAppearance {
  glyph: string;
  terrainLabel: string;
  featureLabel: string | null;
}

export interface ObservedCell {
  visibility: Visibility;
  appearance: CellAppearance | null;
  visualRegion: { token: string; theme: RoomTheme; condition: 0 | 1 | 2; dark: boolean } | null;
}

export interface ObservedDecoration { token: string; at: Position; kind: DecorationKind; rotation: 0 | 1 | 2 | 3; variant: number; scale: number; theme: RoomTheme }

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
  decorations: ObservedDecoration[];
  status: { hp: number; maxHp: number; gold: number; depth: number; hungerStage: number };
  inventory: Array<{ token: string; label: string; quantity: number; category: string; equippedSlot: string | null; assetKey: string | null }>;
  pendingDecision: 'callItem' | 'identifyItem' | null;
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
