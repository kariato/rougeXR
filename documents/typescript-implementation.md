# TypeScript implementation specification

Execution order and small completion gates are tracked in the [phased implementation plan](implementation-plan.md).

Status: implementation contract, not implemented code. This document expands [design.md](design.md) and governs code generation where the architectural sketches are less precise. The selected reference is Davidslv/rogue at `f4653c2a2ee6981a73abe9dfda055134285e1e79`; see [source notes](rogue544-base.md). Never use the historical FreeBSD Clone III report to supply missing rules.

## 1. Generation contract and scope

Generate a standalone browser application with a headless TypeScript engine. Implement the packages below in dependency order. Each package must compile and pass its acceptance cases before dependent work begins. The first deliverable is a playable 2D browser slice; 3D and XR must not block it.

Use native DOM components and Canvas 2D, with Vite as the development/build tool, TypeScript in strict mode, Vitest for headless tests, and Playwright for browser tests. Pin exact compatible dependency versions and commit the lockfile when scaffolding. Do not add a backend, React, an ECS framework, or an event-bus dependency. No dependency versions are prescribed by this document.

Required scripts: `dev`, `build`, `typecheck`, `test`, `test:browser`. Build runs type checking before bundling. Enable `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and `noFallthroughCasesInSwitch`. Use separate engine and browser TypeScript configurations; the engine configuration excludes DOM libraries. Use exhaustive switches with an `assertNever` helper.

The first slice contains generation, walking, bump combat, rest, search, gold/food/weapon pickup and drop, equipment, hunger/healing, a representative monster, stairs, save/load, replay, and the debug inspector. Full content follows using the same APIs. The default generator may emit only mechanics implemented in that slice; label such builds `slice`, never full Rogue fidelity. Unsupported content must be rejected explicitly, not silently treated as a no-op.

The source remains the detailed authority for content probabilities and special abilities. Code generation must read the named pinned C functions before implementing each corresponding module. Transcribe static tables, with provenance, rather than inventing balanced-looking values. This document fixes representation and control flow; it does not pretend all source tables have already been transcribed.

## 2. Files, responsibilities, and imports

| File or directory | Responsibility | Allowed dependencies |
| --- | --- | --- |
| `src/engine/model/` | JSON state, action, event, observation types | None |
| `src/definitions/` | Immutable rules tables and effect identifiers | Model types |
| `src/engine/random.ts` | Specified deterministic RNG | Model types |
| `src/engine/grid.ts` | Bounds, indexes, source-compatible tile predicates | Model types |
| `src/engine/entities.ts` | IDs, location transfers, stack operations | Model, grid |
| `src/engine/scheduler.ts` | Source-ordered daemon/fuse slots | Model; injected effect callback |
| `src/engine/rules/` | Movement, combat, inventory, effects, monsters | Above modules; internal rule context |
| `src/engine/generation/` | Rooms, passages, level population | Rules helpers, definitions, RNG |
| `src/engine/perception/` | Knowledge updates and safe projections | Model, grid, definitions |
| `src/engine/session.ts` | Transactions and command-cycle state machine | All engine modules |
| `src/persistence/` | JSON validation, checksums, save/replay | Public model; engine factory for replay |
| `src/input/desktop.ts` | Keyboard and pending selection | Public action types |
| `src/presentation/grid/` | Canvas renderer and hit testing | Observation types only |
| `src/debug/` | Read-only inspector, reveal renderer, fixtures | Explicit debug snapshots |
| `src/app/` | DOM, storage, startup, dispatch, view switching | Public engine API and adapters |

Rules must not import `session.ts`; session supplies a `RuleContext`. Rules call each other through ordinary functions, never global subscriptions. A test scans imports to enforce no browser/presentation imports under engine. Avoid circular imports by keeping all shared types in model.

## 3. Core representation

Use plain objects, finite numbers, strings, booleans, arrays, and explicit `null`. No `Map`, `Set`, typed arrays, dates, class instances, functions, or `undefined` inside saved state. Runtime derived indexes may use typed arrays or maps. Mutable state is private to the engine; public values are detached snapshots.

```typescript
type EntityId = string; // allocated e1, e2, ...; never reused
type LevelId = number;  // generation serial, not depth
type RoomId = number;   // 0..8 in the initial ruleset
type Direction = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';
interface Position { x: number; y: number }
interface DiceGroup { count: number; sides: number }
type DamageSpec = DiceGroup[];
type Terrain = 'void' | 'floor' | 'wallH' | 'wallV' | 'door' | 'passage';
type TrapKind = 'trapDoor' | 'bear' | 'sleep' | 'arrow' | 'teleport' | 'dart'
  | 'rust' | 'mystery';
type Feature =
  | { kind: 'stairs' }
  | { kind: 'trap'; trap: TrapKind; revealed: boolean };
interface TileState {
  terrain: Terrain;
  secret: boolean;
  feature: Feature | null;
  roomId: RoomId | null;
  passageId: number | null;
}
interface RoomState {
  id: RoomId;
  origin: Position;
  width: number;
  height: number;
  kind: 'room' | 'gone' | 'maze';
  dark: boolean;
  exits: Position[];
  goldTarget: Position | null;
}
interface PassageState { id: number; cells: number[] }
interface LevelState {
  id: LevelId;
  depth: number;
  width: number;
  height: number;
  tiles: TileState[];
  rooms: RoomState[];
  passages: PassageState[];
  stairs: Position;
  monsterOrder: EntityId[];
  floorObjectOrder: EntityId[];
}
```

The initial dimensions are fixed at 80 columns and 24 rows, with playable rows 1 through 22. Never derive logical dimensions from the browser window. Index a cell as `y * width + x`. Reject noninteger or out-of-bounds positions before indexing. Preserve horizontal/vertical wall distinctions for hidden-door observations. A revealed trap remains a floor feature, not a replacement occupancy type.

`goldTarget` preserves the room-related AI target until source mapping proves it can be derived without changing behavior. Replacing C room gold with an entity must not lose greedy-monster targeting. Passage membership is connected-cell metadata, not a claim that each passage is a straight edge between two rooms.

```typescript
interface CombatStats {
  strength: number;
  experience: number;
  level: number;
  armorClass: number;
  hp: number;
  maxHp: number;
  damage: DamageSpec;
}
type ItemLocation =
  | { kind: 'floor'; levelId: LevelId; at: Position }
  | { kind: 'pack'; owner: 'player' | EntityId };
type MonsterTarget =
  | { kind: 'player' }
  | { kind: 'position'; at: Position }
  | { kind: 'item'; id: EntityId };
interface MonsterState {
  kind: 'monster';
  id: EntityId;
  definitionId: string;
  at: Position;
  stats: CombatStats;
  flags: number;
  slowTurn: boolean;
  target: MonsterTarget | null;
  disguise: string | null;
  packOrder: EntityId[];
}
interface ItemBase {
  kind: 'item';
  id: EntityId;
  definitionId: string;
  location: ItemLocation;
  quantity: number;
  flags: number;
  group: number;
  label: string | null;
}
type ItemState = ItemBase & (
  | { category: 'weapon'; hitBonus: number; damageBonus: number }
  | { category: 'armor'; armorClass: number }
  | { category: 'stick'; charges: number }
  | { category: 'ring'; magnitude: number }
  | { category: 'potion' | 'scroll' | 'food' | 'amulet' | 'gold' }
);
type EntityState = MonsterState | ItemState;
interface PlayerState {
  at: Position;
  stats: CombatStats;
  flags: number;
  packOrder: EntityId[];
  equipment: {
    weapon: EntityId | null; armor: EntityId | null;
    leftRing: EntityId | null; rightRing: EntityId | null;
  };
  roomId: RoomId | null;
  gold: number;
}
```

Flags are named numeric constants transcribed from `rogue.h`, separated into actor/item namespaces. Do not invent conflicting bit assignments. Item-specific identification flags and per-type knowledge are distinct. Inventory order arrays preserve source traversal order; they are not a second location authority. Validate that they contain exactly the items belonging to that owner, without duplicates. Position lives only on the monster or the floor location, never both.

The registry is game-owned so carried items survive level destruction. Monster targets must preserve pointer semantics: a target pointing at the player follows the player; do not replace it with a one-time coordinate copy.

Immutable weapon definitions contain melee damage, thrown damage, launcher definition ID or null, and missile flags. Monster definitions contain initial stats/formulas, flags, carrying probability, and source monster code. Generic item definitions contain category, subtype code, generation weight, base value, and effect ID. Generate explicit category unions from transcribed tables. Mutable damage specifications, if changed by a source effect, require per-instance overrides rather than mutation of shared definitions.

```typescript
interface IdentificationEntry {
  definitionId: string;
  appearanceId: string;
  known: boolean;
  called: string | null;
}
interface Counters {
  foodLeft: number; noFood: number; quiet: number; between: number;
  noMove: number; noCommand: number; hungerStage: number;
}
interface GameState {
  rulesId: string;
  mode: 'slice' | 'full';
  seed: number;
  rng: RandomState;
  nextEntitySerial: number;
  nextLevelSerial: number;
  revision: number;
  actionSequence: number;
  tick: number;
  status: 'playing' | 'dead' | 'won';
  maximumDepth: number;
  player: PlayerState;
  level: LevelState;
  entities: Record<EntityId, EntityState>;
  identification: IdentificationEntry[];
  counters: Counters;
  scheduler: SchedulerState;
  cycle: CycleState;
  knowledge: KnowledgeState;
}
```

This is the required slice schema. Before adding a full-content mechanic, extend it with every behaviorally relevant global or static used by that mechanic and add save-continuation coverage. Do not hide healing, monster, running, or effect state in module variables. UI selection and animation time remain outside GameState. Derived equipment bonuses are recomputed from equipment, never saved as competing authority.

## 4. Randomness and numerical behavior

Use a specified port RNG, `xorshift32-v1`. This is an intentional deterministic-port choice, not a claim of binary C RNG parity.

```typescript
interface RandomState { algorithm: 'xorshift32-v1'; word: number; draws: number }
function nextU32(r: RandomState): number {
  let x = r.word >>> 0;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  r.word = x >>> 0;
  r.draws++;
  return r.word;
}
function rnd(r: RandomState, range: number): number {
  if (!Number.isSafeInteger(range) || range < 0) throw new Error('Invalid range');
  if (range === 0) return 0;
  return nextU32(r) % range;
}
```

Accept a decimal uint32 seed; map seed zero to initial word `0x6d2b79f5`, but keep the entered seed in metadata. For initial word 1, the first three outputs must be 270369, 67634689, and 2647435461. `rnd(0)` consumes no draw, matching the source wrapper's zero-range branch. `rnd(1)` consumes one draw. Implement dice as repeated `rnd(sides) + 1` draws; never replace them with a single distribution draw. Use `Math.trunc` for C integer division when negative operands can occur.

Gameplay never calls `Math.random`. Rendering does not receive the RNG. Hallucination appearances are updated at a deterministic engine observation boundary; use a separate saved cosmetic RNG only if the rules ledger explicitly records that divergence. Initially preserve source-related random calls when moving perception logic out of curses, and freeze their results in observations. `observe()` itself consumes no randomness.

## 5. Public session and transaction boundary

```typescript
type EquipmentSlot = 'weapon' | 'armor' | 'leftRing' | 'rightRing';
type GameAction =
  | { type: 'move'; direction: Direction; pickup: boolean }
  | { type: 'rest' }
  | { type: 'search' }
  | { type: 'pickup' }
  | { type: 'drop'; itemId: EntityId }
  | { type: 'equip'; itemId: EntityId; slot: EquipmentSlot }
  | { type: 'remove'; slot: EquipmentSlot }
  | { type: 'use'; itemId: EntityId; direction: Direction | null;
      targetItemId: EntityId | null }
  | { type: 'throw'; itemId: EntityId; direction: Direction }
  | { type: 'stairs'; direction: 'up' | 'down' };
interface ActionRequest { expectedRevision: number; action: GameAction }
interface ActionResolution {
  actionSequence: number;
  status: 'resolved' | 'rejected';
  reason: string | null;
  consumedSlot: boolean;
  ticksAdvanced: number;
  revision: number;
  events: PresentationEvent[];
  observation: PlayerObservation;
}
interface GameSession {
  submit(request: ActionRequest): ActionResolution;
  observe(): PlayerObservation;
  exportState(): GameState; // detached; persistence layer wraps it
}
```

Factory functions: `createGame({seed, mode})` and `restoreGame(validatedState)` return a session. Creation initializes a level and pumps to the first input boundary. Restore must resume the saved boundary without rerunning its BEFORE phase. Expose raw events and state through a separate `DebugSession` wrapper, never ordinary render callbacks.

Use copy-on-command initially: clone the small state, build indexes, resolve the action and mandatory phases on that draft, validate invariants, then commit the draft. An internal exception discards the draft and returns a typed engine fault to the shell; it is not an ordinary rejected move. This is affordable for the initial map and avoids partially committed saves. Optimize only after profiling.

Malformed input and stale revisions are transport errors: no sequence increment, no replay append, no RNG consumption. A well-formed supported request reaches the engine: increment action sequence, even if the rule rejects it, and record it in replay. Increment revision on every such committed request to invalidate old UI commands. Rule rejection can preserve a free slot while still having consumed randomness. Do not roll it back as an exception.

Rule handlers receive `{state, indexes, random, emit}` and return `{consumedSlot, reason, resolved}`. They mutate the draft but do not run the entire turn loop. Nested consequences, such as traps and attacks, return ordered events to the same transaction. Expected gameplay failure uses result values, not exceptions.

## 6. Command-cycle state machine

```typescript
type CyclePhase = 'begin' | 'input' | 'after' | 'terminal';
interface CycleState {
  phase: CyclePhase;
  slotsRemaining: number;
}
```

Only `input` or `terminal` states may be exported as normal saves. Transactions may temporarily use other phases. An input boundary can have one or two slots remaining; the slot count is fixed when the cycle begins, before BEFORE effects, as in source `command()`.

Algorithm for `pumpToInput(draft)`:

1. If dead/won, set terminal and stop immediately; do not run later effects.
2. At `begin`, set slots to 2 if haste is active, otherwise 1. Run BEFORE daemons, then BEFORE fuses. Perform the source pre-input perception update. Set phase to `input`.
3. If `noCommand > 0`, decrement it and run the equivalent forced rest slot without accepting input; emit the recovery message when it reaches zero. Consume the slot. Continue pumping until a real input boundary or terminal state.
4. At `input` with no forced action, return control to the browser. Ordinary `observe()` does nothing further.
5. After a submitted action, perform deferred pickup and source post-command bookkeeping. Decrement slots only if consumed. If slots remain, perform the next slot's pre-input work without repeating BEFORE effects.
6. When no slots remain, set `after`; run AFTER daemons, AFTER fuses, left-ring action, then right-ring action. Stop on death/win between operations. Increment tick; set `begin`; continue to the next real input boundary.

Return `ticksAdvanced` as the tick difference across the entire transaction, including forced skipped turns. A trap can therefore produce multiple ticks. Bound pumping with a large diagnostic operation limit; hitting it is an engine fault with rollback and a bug bundle, never an arbitrary gameplay truncation.

New-level creation inside an action does not reset the command-cycle state by default. Preserve the source action's time policy. Stairs commands explicitly set `after = FALSE` in the selected source; their normal successful transition must not automatically spend a slot just because the level changed.

Define a trace hook for tests: `phase`, `effect`, `action`, `pickup`, `ring`, `inputReady`. It writes debug data only and cannot affect control flow.

## 7. Scheduler implementation

```typescript
type EffectId = string; // closed generated union from registered source effects
interface ScheduledEntry {
  effect: EffectId;
  arg: number;
  phase: 'before' | 'after';
  remaining: number; // -1 daemon; positive fuse; zero inert source state
}
interface SchedulerState { slots: (ScheduledEntry | null)[] } // length 20
```

Provide `startDaemon`, `scheduleFuse`, `lengthen`, `extinguish`, `killDaemon`, `runDaemons`, and `runFuses`. Use the first empty slot for allocation. Find operations match the first registered effect as source function-pointer lookup does. Generate EffectId from an explicit registry; unknown effects fail save validation.

Iterate the live array in ascending index order, not a sorted due-time queue or a copied snapshot. A callback can alter later slots and those changes affect the same pass. Daemons run if phase matches and remaining is -1. Fuses decrement only matching positive durations; when reaching zero, clear the slot before invoking the callback. This permits the callback to reuse the slot. A newly inserted earlier slot is not revisited; a later slot can still be visited.

Default registration follows `main.c`: runners AFTER, doctor AFTER, swander fuse AFTER, stomach AFTER, in source allocation order. In a phase, all daemons run before fuses regardless of interleaving slots. Do not replace doctor with a fixed healing interval: port its `quiet`, level, and regeneration-ring logic. The wanderer daemon's `between` counter is saved.

Scheduler overflow throws an explicit engine fault and rolls back the transaction; never corrupt memory or silently drop effects. Record this defined error behavior as a portability difference.

## 8. Entities, stacking, and indexes

`buildIndexes(state)` creates monster-by-cell, object-by-cell, and entity lookup helpers. Player occupancy is separate. A tile can hold a monster over an object. Initial source rules permit at most one floor object entity per cell; a quantity stack is one entity. Index validation rejects overlap rather than overwriting an entry.

Implement `allocateId`, `insertMonster`, `insertItem`, `transferItem`, `splitStack`, `mergeStacks`, `destroyItem`, and `destroyMonster`. All call sites use these functions for ownership/order changes. A transfer validates destination before removing the item from its source. Stack merging uses source `pack.c` compatibility, including grouping and enchantments, not category alone. Destroy the merged-away ID and emit its replacement ID for UI selection cleanup.

`drop` follows source stack-selection behavior; the initial action deliberately has no arbitrary quantity field. Throw/use can detach one unit using `splitStack` when the source does so. Equipped-item removal checks curses before altering the pack. Gold collection increments purse then destroys the floor entity. Death detaches carried items according to source fall/drop placement before removing the monster; do not regenerate all loot at death.

Maintain order arrays using the equivalent of source attach/detach operations. These arrays are validated serialized order, since changing iteration order can change AI and random outcomes. On a level transition, delete floor objects, monsters, and their packs; retain player-owned items and monotonic ID allocation.

## 9. Generation pipeline

Implement `buildLevel(context, depth): LevelState` as part of the same transactional state, using the shared RNG and entity allocator. Reproduce the order in `new_level.c`: clear held state; update maximum depth; clear old level objects and monsters; `do_rooms`; `do_passages`; increment no-food counter; `put_things`; traps; stairs; monster room assignment; player placement; room entry observation.

Port room placement from `rooms.c`, including gone/dark/maze flags, room population, and gold targeting. Port graph construction and tunnel carving from `passages.c`; use explicit typed edge records in place of pointer arithmetic. Assign passage membership using source connectivity behavior. Keep temporary generator bookkeeping local unless it affects future generations; any persistent source static must be moved into saved state or reset by an explicit documented policy.

Represent generation stages as trace events in debug mode. A seed fixture must report which stage first diverged. Do not silently regenerate until a map looks acceptable: this changes RNG consumption and can hide bugs. Bound pathological placement loops with a diagnostic fault, identifying the seed and stage.

Connectivity tests use potential traversability, including secret passages, rather than requiring every hidden connection to be immediately walkable. Also verify valid player/stairs placement, nine room slots, unique entity IDs, and consistent floor occupancy. Use fixed seeds and depth-specific fixtures; do not assert that every slot contains an ordinary room.

## 10. Movement and combat algorithms

Movement uses a fixed direction-to-offset table. Port `do_move` branch order, particularly:

1. A positive no-move counter decrements and consumes the action before destination calculation.
2. Confusion can choose a randomized move. A no-displacement result can be free according to the source; retain consumed RNG draws.
3. Bounds and `diag_ok` are checked before destination interaction. The selected `diag_ok` uses `step_ok` on both orthogonal cells. Do not import Clone III's blanket diagonal-door restriction.
4. Resolve hidden traps, levitation, and held-state restrictions in source order.
5. A monster destination resolves bump combat; player position remains unchanged. A legal empty destination updates position and room/passage consequences.
6. Teleport/trap-door effects may return before ordinary position assignment. Emit only the actual final movement, not a fictitious intermediate move.
7. Deferred pickup occurs at the command layer after movement, as selected `command.c` does.

Give `canStepTerrain`, `canMoveDiagonally`, `resolveMove`, `resolveTrap`, and `transitionRegion` separate tests. Use a source-compatibility adapter for glyph-based predicates; engine rules must not read canvas pixels or visible monster labels.

Damage strings in this repository use `x`, for example `1x6/1x4`, not the `d` notation in the original ideas. Parse once with an anchored grammar for slash-separated nonnegative integer groups. Reject malformed definitions at startup. Preserve zero-count groups if the source uses them.

`resolveAttack` constructs hit and damage modifiers from `roll_em`:

- Choose natural, weapon, or thrown damage according to the source launcher rules.
- Include equipped weapon rings, defender non-running +4 hit bonus, player armor, and protection rings.
- For each damage group, independently test `rnd(20) + hitModifier + strengthHitBonus >= 20 - attackerLevel - defenderArmor`.
- On a hit, roll that group's dice and subtract `max(0, diceTotal + damageModifier + strengthDamageBonus)` from HP.
- Preserve group order and source handling of death/special attacks after the group resolution; do not move death handling into each die roll.

Copy strength tables from the pinned source with tests for table boundaries. Do not substitute familiar D&D formulas. Include attack-group details in raw debug events but only appropriate hit/miss descriptions in player events. Full monster special attacks remain separate named handlers rather than a growing switch in the renderer.

## 11. Monster and item modules

Port `runners`, chase decisions, and source target updates without replacing them with A* pathfinding. Iterate `monsterOrder` in source-equivalent order. Before processing each ID, confirm it still exists; removal, teleport, and death can invalidate later assumptions. Movement uses the same occupancy helpers but source-specific monster predicates. Sleep, slow/haste, held behavior, and disguise belong to rules, not animation state.

Each item category exports a handler accepting the already committed item and target. Validation checks player ownership, category, equipment constraints, charges, and target requirements before resolving effects. Identification changes are emitted separately from consumption. Unsupported target-dependent effects fail before consuming an item.

Some scroll effects require another item selection. The first UI slice gathers all required parameters before commit when the item is known. For unknown effects that request a choice only after activation, implement a serialized pending-decision state before enabling that content: action activation, decision prompt, response, and cancellation consequences must follow the source. Do not identify the scroll in the UI merely to preselect a target. Such effects are excluded from slice generation until that extension and replay coverage exist.

For each content category, transcribe definition data separately from runtime effects. Each definition includes `sourceFile`, `sourceSymbol`, stable ID, appearance category, initial generation data, and handler ID. A startup coverage check requires every enabled definition to have a handler. No reflection or dynamically evaluated handler names.

## 12. Perception, memory, and event privacy

```typescript
interface CellAppearance {
  glyph: string;
  terrainLabel: string;
  featureLabel: string | null;
}
interface KnowledgeState {
  levelId: LevelId;
  remembered: (CellAppearance | null)[];
}
interface ObservedEntity {
  token: string;
  at: Position;
  appearance: string;
  label: string;
}
interface PlayerObservation {
  revision: number;
  width: number;
  height: number;
  playerAt: Position;
  cells: ({ visibility: 'unknown' | 'remembered' | 'visible';
    appearance: CellAppearance | null })[];
  entities: ObservedEntity[];
  inventory: { token: string; label: string; quantity: number }[];
  status: { hp: number; maxHp: number; gold: number; depth: number };
}
```

Keep transient current visibility derived from state at a prepared input boundary; save remembered appearances. Expand observation status for hunger, equipment, and effects as implemented. Unknown cells have no terrain label, hidden feature, entity ID, or room metadata. Remembered terrain is a snapshot, never a pointer to current hidden state. If remembered objects are preserved under the selected rules, add explicit last-seen records; do not enumerate current entities in a remembered room.

Implement knowledge transitions from `look`, `enter_room`, `leave_room`, `cansee`, `see_monst`, detection, blindness, and hallucination. A generic radius field of view is not a faithful replacement. Reading observation twice must return equivalent values without changing state.

Define raw events as a discriminated union: actor moved, attack group resolved, HP changed, item transferred, item destroyed, identity learned, feature revealed, effect changed, level changed, game ended, and source message. Every raw event has deterministic ordinal and action sequence. Attach safe presentation events at emission using perception at that moment; do not filter all raw events solely against final visibility. An unseen attack can yield a generic audible/source message without revealing species or hidden coordinates. Raw debug payloads never flow through the ordinary renderer interface.

Use a closed `PresentationEvent` union of message, visible movement, visible attack, inventory update, and level-view reset. Strings inserted into DOM use `textContent`. Scene or audio adapters consume only this union and observation. Reveal mode draws a separate debug layer and never alters the normal observation.

## 13. Persistence and replay

```typescript
interface SaveEnvelope {
  format: 'rougexr-save';
  version: 1;
  upstream: 'f4653c2a2ee6981a73abe9dfda055134285e1e79';
  state: GameState;
}
interface ReplayEntry {
  action: GameAction;
  expectedRevision: number;
  expectedHash: string;
}
interface ReplayBundle {
  format: 'rougexr-replay';
  version: 1;
  initial: SaveEnvelope;
  entries: ReplayEntry[];
}
```

Implement `parseSave(text): Result<SaveEnvelope, ValidationError[]>`, `serializeSave`, `canonicalState`, and async `hashState`. Validate shape, enum membership, finite safe integers, map sizes, registry key/ID equality, definition/effect IDs, ownership/order equality, equipment ownership, cycle boundary, scheduler length, HP ranges appropriate to terminal state, and uint32 RNG values. Limit imports to 5 MiB initially and reject oversized or structurally excessive data before deep traversal. Unknown versions produce an explicit incompatibility error. Do not merge imported objects into live state.

Canonical serialization recursively sorts object keys and preserves array order; it includes RNG, knowledge, counters, cycle, and ordered inventories. Exclude browser metadata and debug logs because they are not GameState. Hash UTF-8 canonical JSON with SHA-256 in the persistence adapter, not the engine. Publish a small known canonicalization fixture to test browser/headless equality.

Serialize dispatch while an asynchronous hash/autosave is pending, or hash the detached post-action snapshot and associate it with that exact action. Do not hash a later live state. Replay restores its initial save, submits entries through the same session API, and compares each resulting hash. Abort at the first mismatch; report index and expected/actual hash. State differences require an optional expected snapshot and must not be claimed from hashes alone.

Retain up to 1,000 replay entries. At rotation, restore the checkpoint and replay the evicted prefix into a new checkpoint, then retain the suffix; alternatively keep detached periodic checkpoints. Never advance the checkpoint to a state later than the first retained action. Manual saves do not erase history until their captured state becomes an explicit new replay checkpoint.

Use IndexedDB through a small `SaveStore` adapter with `loadLatest` and `storeLatest`. Serialize writes in action order. On failure show a storage status and keep manual download enabled. Loading validates and constructs a candidate session first, then swaps the shell session only on success. Clear stale selections after a successful swap.

## 14. Browser shell and renderer

`AppController` owns one session, one replay recorder, one input controller, and one renderer. Startup creates the DOM, attempts saved-game restoration, otherwise creates the fixed default seed game. A failed autosave import offers a new game while retaining the invalid file for manual export; never trap the user in a startup loop.

Input states are `idle`, `inventory`, `chooseDirection`, `chooseItem`, `busy`, and `replay`. Escape clears an uncommitted UI choice. Store selected observation token with its revision; map to an engine item ID only in the controller. Revalidate on commit. Ignore repeat keydown and shortcuts from editable targets. Give the canvas a focusable container and visible focus indicator.

For player inventory, the token may equal its stable item ID: possession already permits selection. Visible-world tokens must not encode hidden definition names. A target action uses direction initially, avoiding an API that lets a guessed hidden monster ID become a valid attack. Debug entities are never added to the controller's selectable inventory mapping.

Dispatch sequence: resolve UI intent -> snapshot revision -> mark busy -> submit -> update observation and player log -> record detached replay state/hash -> request autosave -> render -> release busy. Storage failure does not roll back gameplay. Animation completion does not call the engine. New-game/load/replay controls cannot swap the session in the middle of this sequence.

Canvas layout: compute `cellSize = floor(min(availableWidth / width, availableHeight / height))`, clamped to at least 1 CSS pixel; center the map and use scrolling at small sizes if needed. Size the backing buffer using devicePixelRatio, then scale the context once. Hit testing subtracts the canvas bounding rectangle and centered offset, divides by CSS cell size, floors, and checks bounds. Do not apply devicePixelRatio twice. Resize changes only view parameters.

Draw layers in order: unknown background, remembered terrain, visible terrain/features, observed objects/monsters, player, selected-cell outline, optional debug overlay. Initial rendering uses glyphs and flat colors. Keep an adjacent text description for selection and a bounded DOM message log. Whole-map redraw is acceptable for 1,920 cells; do not add dirty-region complexity initially.

The inspector reads detached debug snapshots and renders explicit fields. A raw JSON section is collapsible. Clicking the inspector cannot dispatch gameplay. Replay controls use the same renderer but disable live gameplay input. Do not poll engine state every animation frame; render from the last observation.

## 15. Desktop 3D and XR extension contract

```typescript
interface GameView {
  mount(host: HTMLElement): void;
  update(observation: PlayerObservation, events: PresentationEvent[]): void;
  resize(width: number, height: number): void;
  dispose(): void;
}
```

Implement this first for Canvas 2D. Add a Three.js implementation later. It maps grid `(x,y)` to world `(x * tileScale, height, y * tileScale)` consistently; one tile initially equals one world unit. Camera rig offset and tabletop scale are separate transforms. Store only presentation transforms outside GameState.

Room meshes are keyed by level ID and region key. Shared materials/geometries use reference-counted ownership; disposing a room must not dispose assets still used elsewhere. Async asset results carry a scene-generation token and are discarded if the active level changed. Primitive placeholders remain until assets arrive. View switching calls dispose/mount and then update with the current observation; it does not restart the engine or replay events.

XR capability detection and session creation live outside GameView's logical contract. XR actions go through the same controller with revision validation. Physical tracking never writes actor position. Headset-only acceptance tests are added after the desktop 3D gate.

## 16. Source-to-module implementation checklist

| Source | Target | Required extraction |
| --- | --- | --- |
| `rogue.h`, `extern.c`, `extern.h` | model and definitions | Types, flags, tables, global-state inventory |
| `init.c`, `main.c` | initialization | Starting pack/stats, appearance randomization, initial scheduler |
| `command.c` | session/actions | Cycle boundaries, free commands, deferred pickup, search, ring order |
| `daemon.c`, `daemons.c` | scheduler/effects | Live slot semantics, doctor/stomach/wander state, timed recovery |
| `rooms.c`, `passages.c`, `new_level.c` | generation | Geometry, population, cleanup, room transitions |
| `move.c`, `chase.c` | movement/AI | Diagonal legality, traps, targets, runners, visibility predicates |
| `fight.c`, `weapons.c`, `armor.c` | combat/equipment | Dice groups, bonuses, death, missiles, equipment constraints |
| `pack.c`, `things.c` | inventory/items | Stacking, ordering, pickup, removal, item generation |
| `potions.c`, `scrolls.c`, `sticks.c`, `rings.c` | content effects | Identification, use, targets, durations, side effects |
| `io.c` and visual calls across rules | perception/messages | Replace screen reads with semantic knowledge |
| `save.c`, `state.c` | persistence reference | Inventory of state; do not reproduce binary file format |

For every ported function, record source symbol, target function, saved state it touches, time policy, RNG calls, and tests in the rules ledger. Treat source macros such as `when`, `winat`, `on`, and `attach` according to their definitions before translating branches. Do not perform mechanical text substitution.

## 17. Concrete acceptance cases

| ID | Setup/action | Expected assertion |
| --- | --- | --- |
| R01 | RNG word 1 | First three outputs match section 4 |
| R02 | Call rnd(0), then rnd(1) | First does not advance draws; second does |
| T01 | Normal input boundary; submit rest | One cycle completes; next BEFORE executes once |
| T02 | Hasted input boundary; submit two rests | First consumes one slot with no AFTER; second runs AFTER |
| T03 | Blocked ordinary move repeated | No slot consumed; no repeated BEFORE processing |
| T04 | Save between hasted actions | Restore + second action equals uninterrupted state |
| T05 | Fuse callback inserts a later-slot fuse | Same-pass behavior matches live source iteration |
| T06 | Fuse expires and schedules into freed slot | New entry survives; current index is not revisited |
| T07 | Forced no-command turns | No browser input needed; deterministic ticks and recovery |
| M01 | Diagonal with one blocked orthogonal cell | Result follows selected step_ok predicate |
| M02 | Bear-trap noMove positive | Decrements before movement; consumes slot |
| M03 | Confusion produces current position | Free result retains RNG changes |
| C01 | Scripted RNG at hit threshold | Below threshold misses; equality hits |
| C02 | Two damage groups; first misses | Independent second hit roll still occurs |
| I01 | Monster stands over floor item | Both indexes retained; monster movement preserves item |
| I02 | Merge compatible stack | Survivor quantity correct; retired ID absent everywhere |
| I03 | Drop cursed equipped item | Equipment and pack remain consistent with source rejection |
| L01 | Level transition carrying weapon | Same weapon ID/equipment survives; old monsters/packs removed |
| P01 | Hidden monster moves | Raw debug event exists; ordinary observation/event hides it |
| P02 | observe and reveal toggle repeated | Canonical gameplay state and RNG unchanged |
| S01 | Save/load after effects and identification | Continuation hashes equal uninterrupted run |
| S02 | Duplicate item ownership in imported JSON | Load rejected; current session unchanged |
| S03 | Replay log rotates | Retained actions replay from replacement checkpoint |
| B01 | Browser has no navigator.xr | 2D game starts and responds to keyboard |
| B02 | Seed text field focused; press movement key | No gameplay action |
| B03 | Resize at devicePixelRatio 2 | Selected cell matches drawn cell |
| B04 | Storage write fails | Gameplay continues; manual save remains usable |

Expected rule outcomes must be checked against the pinned source before marking source-fidelity tests complete. Use scripted RNG adapters in rule unit tests; production RNG remains fixed. Generation tests use a modest fixed seed set spanning shallow and deep levels and validate invariants as well as deterministic hashes. Hash snapshots alone are not proof of source fidelity.

## 18. Code generation work packages

1. **Scaffold and model:** configs, scripts, types, flags, definition manifest, RNG, grid helpers, state validator. Gate: typecheck, R01/R02, invalid-state tests. Produce no placeholder gameplay claims.
2. **State operations and scheduler:** entity transfers/indexes, scheduler, draft transaction, cycle machine with fixtures. Gate: T01–T07, I01/I02, rollback tests.
3. **Generation:** port initialization and dungeon stages with source table attribution. Gate: deterministic seeds, occupancy/connectivity invariants, L01 fixture.
4. **Playable rules:** movement, rest/search, combat, basic inventory, effects and monster behavior for enabled slice definitions. Gate: M/C/I tests and no missing enabled handlers.
5. **Browser 2D:** shell, input, map, messages, inspector and reveal. Gate: B01–B03 and P01/P02; a user can start, move, fight, inspect, and descend without a headset.
6. **Persistence:** validated saves, IndexedDB, manual files, replay and export. Gate: S01–S03/B04, including haste and forced-turn continuation.
7. **Full content:** port remaining definitions/effects and pending decisions, expand schema and replay deliberately. Gate: coverage manifest complete before enabling full mode.
8. **Desktop 3D, then XR:** implement view contract and resource lifecycle. Gate: identical engine replay hashes across views; no engine imports from Three.js/WebXR.

For each package, generate code and focused tests together, run its gates, update the rules ledger with actual status, then continue. Do not stub an unimplemented rule with success. Do not describe the full port as complete when only the browser slice is playable.
