import type { Direction } from './state';

export type GameAction =
  | { type: 'move'; direction: Direction; pickup: boolean }
  | { type: 'rest' }
  | { type: 'fixture'; name: string };

export interface ActionRequest { expectedRevision: number; action: GameAction }
export interface EngineEvent { type: string; message?: string }
export interface ActionResolution {
  actionSequence: number;
  status: 'resolved' | 'rejected';
  reason: string | null;
  consumedSlot: boolean;
  ticksAdvanced: number;
  revision: number;
  events: EngineEvent[];
}

export type TraceKind = 'phase' | 'effect' | 'action' | 'pickup' | 'ring' | 'inputReady';
export interface TraceEntry { kind: TraceKind; detail: string; tick: number }
