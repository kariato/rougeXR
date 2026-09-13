/** Phase 1 state only. Turn, perception, and save-envelope schemas arrive later. */
export type EntityId = string;
export interface Position { x: number; y: number }
export type Direction = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';
export type EquipmentSlot = 'weapon' | 'armor' | 'leftRing' | 'rightRing';
export interface DiceGroup { count: number; sides: number }
export type Terrain = 'void' | 'floor' | 'wallH' | 'wallV' | 'door' | 'passage';
export type TrapKind = 'trapDoor' | 'bear' | 'sleep' | 'arrow' | 'teleport' | 'dart' | 'rust' | 'mystery';
export type Feature = { kind: 'stairs' } | { kind: 'trap'; trap: TrapKind; revealed: boolean };
export interface TileState {
  terrain: Terrain; secret: boolean; feature: Feature | null;
  roomId: number | null; passageId: number | null;
}
export interface RoomState {
  id: number; origin: Position; width: number; height: number;
  kind: 'room' | 'gone' | 'maze'; dark: boolean;
  exits: Position[]; goldTarget: Position | null;
}
export interface PassageState { id: number; cells: number[] }
export interface LevelState {
  id: number; depth: number; width: number; height: number;
  tiles: TileState[]; rooms: RoomState[]; passages: PassageState[];
  stairs: Position; monsterOrder: EntityId[]; floorObjectOrder: EntityId[];
}
export interface CombatStats {
  strength: number; experience: number; level: number; armorClass: number;
  hp: number; maxHp: number; damage: DiceGroup[];
}
export type ItemLocation =
  | { kind: 'floor'; levelId: number; at: Position }
  | { kind: 'pack'; owner: 'player' | EntityId };
export type MonsterTarget = { kind: 'player' } | { kind: 'position'; at: Position } | { kind: 'item'; id: EntityId };
export interface MonsterState {
  kind: 'monster'; id: EntityId; definitionId: string; at: Position;
  stats: CombatStats; flags: number; slowTurn: boolean;
  target: MonsterTarget | null; disguise: string | null; roomId: number | null;
  packOrder: EntityId[];
}
interface ItemBase {
  kind: 'item'; id: EntityId; definitionId: string; location: ItemLocation;
  quantity: number; flags: number; group: number; label: string | null;
}
export type ItemState = ItemBase & (
  | { category: 'weapon'; hitBonus: number; damageBonus: number }
  | { category: 'armor'; armorClass: number }
  | { category: 'stick'; charges: number }
  | { category: 'ring'; magnitude: number }
  | { category: 'potion' | 'scroll' | 'food' | 'amulet' | 'gold' }
);
export type EntityState = MonsterState | ItemState;
export interface PlayerState {
  at: Position; stats: CombatStats; flags: number; packOrder: EntityId[];
  equipment: { weapon: EntityId | null; armor: EntityId | null; leftRing: EntityId | null; rightRing: EntityId | null };
  roomId: number | null; gold: number; maximumStrength: number;
}
export interface RandomState { algorithm: 'xorshift32-v1'; word: number; draws: number }
export type CyclePhase = 'begin' | 'input' | 'after' | 'terminal';
export interface CycleState { phase: CyclePhase; slotsRemaining: number }
export interface ScheduledEntry {
  effect: string; arg: number; phase: 'before' | 'after'; remaining: number;
}
export interface SchedulerState { slots: Array<ScheduledEntry | null> }
export interface RememberedAppearance { glyph: string; terrainLabel: string; featureLabel: string | null }
export interface KnowledgeState { levelId: number; remembered: Array<RememberedAppearance | null> }
export interface IdentificationEntry {
  definitionId: string; appearanceId: string; known: boolean;
  called: string | null; worth: number | null;
}
export interface TimingState {
  revision: number; actionSequence: number; tick: number;
  status: 'playing' | 'dead' | 'won';
  noCommand: number; noMove: number; hasted: boolean;
  foodLeft: number; noFood: number; quiet: number; between: number; hungerStage: number;
  scheduler: SchedulerState; cycle: CycleState;
}
export interface WorldState {
  seed: number; rng: RandomState; nextEntitySerial: number;
  level: LevelState; player: PlayerState; entities: Record<EntityId, EntityState>;
  timing: TimingState; knowledge: KnowledgeState; identification: IdentificationEntry[];
}
