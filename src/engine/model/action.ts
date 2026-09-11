import type { Direction, EquipmentSlot, Position } from './state';

export type GameAction =
  | { type: 'move'; direction: Direction; pickup: boolean }
  | { type: 'rest' }
  | { type: 'search' }
  | { type: 'pickup' }
  | { type: 'drop'; itemId: string }
  | { type: 'equip'; itemId: string; slot: EquipmentSlot }
  | { type: 'unequip'; slot: EquipmentSlot }
  | { type: 'eat'; itemId: string }
  | { type: 'fixture'; name: string };

export interface ActionRequest { expectedRevision: number; action: GameAction }
export type PresentationEvent =
  | { type: 'message'; text: string }
  | { type: 'visibleMovement'; token: string; from: Position; to: Position }
  | { type: 'inventoryUpdate' }
  | { type: 'levelViewReset' };
export type RawEventInput =
  | { type: 'actorMoved'; actorId: 'player' | string; from: Position; to: Position }
  | { type: 'attackResolved'; attackerId: string; defenderId: string; groupIndex: number; roll: number; hit: boolean; damage: number }
  | { type: 'hpChanged'; actorId: string; from: number; to: number }
  | { type: 'actorDefeated'; actorId: string; byActorId: string }
  | { type: 'itemCollected'; itemId: string; category: string; quantity: number }
  | { type: 'itemDropped'; itemId: string; category: string; quantity: number }
  | { type: 'equipmentChanged'; slot: string; itemId: string | null }
  | { type: 'itemConsumed'; itemId: string; category: string }
  | { type: 'featureRevealed'; at: Position; feature: string }
  | { type: 'sourceMessage'; text: string };
export type RawEvent = RawEventInput & { ordinal: number; actionSequence: number };
export interface ActionResolution {
  actionSequence: number;
  status: 'resolved' | 'rejected';
  reason: string | null;
  consumedSlot: boolean;
  ticksAdvanced: number;
  revision: number;
  events: PresentationEvent[];
}

export type TraceKind = 'phase' | 'effect' | 'action' | 'pickup' | 'ring' | 'inputReady';
export interface TraceEntry { kind: TraceKind; detail: string; tick: number }
