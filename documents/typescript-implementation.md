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
  roomId: RoomId | null;
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

Ring appraisal value is not purely static across games: the source shuffles a gem-name pool onto ring definitions at startup, and each gem carries its own worth that is added into that ring type's price for the game (section 4.11). `IdentificationEntry.worth` holds that resolved per-game value for definitions whose price is randomized this way; `ItemDefinition`'s own base value stays the source's nominal figure and is not itself sufficient for rings once this randomization is implemented.

```typescript
interface IdentificationEntry {
  definitionId: string;
  appearanceId: string;
  known: boolean;
  called: string | null;
  worth: number | null;
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

## 4. Source field provenance and flag constants

Content below is transcribed directly from [rogue.h at the pinned commit](https://github.com/Davidslv/rogue/blob/f4653c2a2ee6981a73abe9dfda055134285e1e79/rogue.h). It gives the exact C field each interface field in section 3 replaces, and defines the flag/content-type constants that section 3 leaves as an opaque `number` or a generic union. Read this section before implementing anything that touches `flags`, `TileState.feature`, or a content-type identifier. It does not transcribe the `info[]`/monster probability tables themselves (`things.c`, `init.c`, `monsters.c`); that data still needs its own pass per section 17's checklist.

### 4.1 Size constants

| C constant | Value | JSON representation |
| --- | --- | --- |
| `MAXROOMS` | 9 | `LevelState.rooms.length` (fixed at 9 in the initial ruleset) |
| `MAXPASS` | 13 | Upper bound on `LevelState.passages.length` |
| `NUMLINES` / `NUMCOLS` | 24 / 80 | `LevelState.height` / `LevelState.width` |
| `MAXTRAPS` | 10 | Informational; traps are represented per-tile (`TileState.feature`), not as a separate fixed-size array |
| `MAXPACK` | 23 | Pack capacity check in inventory rules (section 9) |
| `MAXDAEMONS` | 20 | `SchedulerState.slots.length` |
| `AMULETLEVEL` | 26 | Depth at which the Amulet of Yendor generates (full-content, Phase 11 of the implementation plan) |
| `MAXPOTIONS` / `MAXSCROLLS` / `MAXWEAPONS` / `MAXARMORS` / `MAXRINGS` / `MAXSTICKS` | 14 / 18 / 9 / 8 / 14 / 14 | Length of each content-type union in 4.15 |

### 4.2 `coord` -> `Position`

Exact match: `{x: number, y: number}`.

### 4.3 `struct room` -> `RoomState`

| C field | Type | `RoomState` field | Notes |
| --- | --- | --- | --- |
| `r_pos` | `coord` | `origin` | |
| `r_max` | `coord` | `width`, `height` | Split into two scalars |
| `r_gold` | `coord` | `goldTarget` | Position only; the amount no longer lives on the room |
| `r_goldval` | `int` | *(none)* | Gold becomes an `ItemState` with `category: 'gold'`; `goldTarget` preserves only the AI-targeting position, per the design.md decision not to special-case gold on the room |
| `r_flags` | `short` | `dark`, `kind` | See 4.14; `ISDARK` -> `dark: boolean`, `ISGONE`/`ISMAZE` -> `kind: 'gone' \| 'maze'`, decomposed rather than kept as a raw bitmask |
| `r_nexits` | `int` | *(implicit)* | `exits.length` |
| `r_exit[12]` | `coord[12]` | `exits: Position[]` | Fixed max 12 in source; unbounded array here |

### 4.4 `struct stats` -> `CombatStats`

| C field | `CombatStats` field |
| --- | --- |
| `s_str` (`str_t`, unsigned int) | `strength` |
| `s_exp` | `experience` |
| `s_lvl` | `level` |
| `s_arm` | `armorClass` |
| `s_hpt` | `hp` |
| `s_dmg` (`char[13]`) | `damage` (parsed to `DamageSpec`; source uses `x`-separated dice groups, e.g. `1x6/1x4`, matching section 11) |
| `s_maxhp` | `maxHp` |

### 4.5 `union thing`, creature half -> `MonsterState` / `PlayerState`

| C field | Type | Target field | Notes |
| --- | --- | --- | --- |
| `l_next`, `l_prev` | `union thing *` | *(none)* | Replaced by `monsterOrder` / `packOrder` arrays (section 9) |
| `t_pos` | `coord` | `at` | |
| `t_turn` | `bool` | `slowTurn` | Confirmed in `chase.c` `move_monst()`: a slowed monster (`ISSLOW`) only chases when `t_turn` is true, and the field is XOR-toggled every turn (`tp->t_turn ^= TRUE`), giving slowed monsters one move every other turn; hasted monsters bypass the check. `slowTurn` is the correct name and semantics |
| `t_type` | `char` | `definitionId` | Monster species letter replaced by a stable string ID |
| `t_disguise` | `char` | `disguise` | |
| `t_oldch` | `char` | *(dropped)* | Curses redraw bookkeeping (the glyph to restore under a moved monster); unnecessary once `TileState.terrain` is the authoritative source of a cell's appearance |
| `t_dest` | `coord *` | `target` | Folded into the `MonsterTarget` discriminated union, which is more explicit than a raw pointer |
| `t_flags` | `short` | `flags: number` | See the `CreatureFlag` bit table in 4.14 |
| `t_stats` | `struct stats` | `stats` | |
| `t_room` | `struct room *` | `roomId` | Resolved: `MonsterState` now carries `roomId: RoomId \| null` (section 3). Confirmed in `monsters.c` (`new_monster()` sets it via `roomin()`) and `chase.c` (`relocate()` updates it on move; `do_chase()` and `find_dest()` read it for pathing and for the greedy-monster gold-room check, `tp->t_room == proom`) |
| `t_pack` | `union thing *` | `packOrder` | |
| `t_reserved` | `int` | *(dropped)* | Unused padding in the original struct |

### 4.6 `union thing`, object half -> `ItemState`

| C field | Type | Target field | Notes |
| --- | --- | --- | --- |
| `l_next`, `l_prev` | `union thing *` | *(none)* | Replaced by `floorObjectOrder` / `packOrder` |
| `o_type` | `int` | `category` | Was one of the screen-glyph constants (`POTION`, `SCROLL`, ...); replaced by the semantic `category` union. See 4.13 for the glyph correspondence |
| `o_pos` | `coord` | `location` (`{kind: 'floor', ...}` variant) | Meaningless while carried in the source; the `ItemLocation` union makes that explicit instead of leaving a stale coordinate |
| `o_text` | `char *` | *(none)* | Resolved: confirmed against `things.c`. Scroll titles are read from a shared global array indexed by subtype (`s_names[which]`, formatted as `"titled '%s'"` when `oi_know`/`oi_guess` are both unset), not from a per-object `o_text`. `o_text` itself was not found being assigned in either `things.c` or `scrolls.c`; treat it as unused for the mechanics this project ports. `IdentificationEntry.appearanceId` fully covers per-type title/appearance assignment; no `ItemState` field is needed |
| `o_launch` | `int` | *(definition-level)* | Lives on the weapon's `ItemDefinition` (`launcher definition ID or null` in section 3), not the instance, since it's static per weapon type |
| `o_packch` | `char` | *(dropped)* | Inventory-letter assignment is a browser/app concern (section 15), not engine state |
| `o_damage` | `char[8]` | *(definition-level)* | Melee `DamageSpec` on the weapon's `ItemDefinition` |
| `o_hurldmg` | `char[8]` | *(definition-level)* | Thrown `DamageSpec` on the weapon's `ItemDefinition` |
| `o_count` | `int` | `quantity` | |
| `o_which` | `int` | *(folded into `definitionId`)* | Subtype index; the instance's `definitionId` already resolves to one specific `ItemDefinition` that encodes category + subtype |
| `o_hplus` | `int` | `hitBonus` (`weapon` variant) | |
| `o_dplus` | `int` | `damageBonus` (`weapon` variant) | |
| `o_arm` | `int` | `armorClass` (`armor` variant) / `charges` (`stick` variant, via the `o_charges` alias) / folded into `quantity` (`gold` variant, via the `o_goldval` alias) | One C field serves three different roles depending on `o_type`; the discriminated `ItemState` union spells each out as a separate named field instead |
| `o_flags` | `int` | `flags: number` | See the `ItemFlag` bit table in 4.14 |
| `o_group` | `int` | `group` | |
| `o_label` | `char *` | `label` | |

### 4.7 `PLACE` -> `TileState`

| C field | Type | Target field | Notes |
| --- | --- | --- | --- |
| `p_ch` | `char` | *(dropped)* | Terminal glyph; `terrain` + `feature` are authoritative instead |
| `p_flags` | `char` | see below | Bit-packed; see the `TileFlag` table |
| `p_monst` | `THING *` | *(none)* | Occupancy is derived from the entity index (section 9), not stored redundantly on the tile |

`p_flags` bit layout (`F_PNUM` / `F_TMASK` occupy the same low bits, disambiguated by `F_PASS`):

| Bit | C constant | Value | Target | Notes |
| --- | --- | --- | --- | --- |
| low 3 bits | `F_TMASK` | `0x07` | `feature.trap` (`TrapKind`) | 8 trap kinds fit exactly in 3 bits; `TileState.feature` stores the resolved `TrapKind` directly rather than requiring a lookup by index |
| low 4 bits | `F_PNUM` | `0x0f` | `roomId` / `passageId` | 4 bits (0-15) is too small to index both 9 rooms and 13 passages at once; almost certainly `F_PASS` disambiguates which namespace `F_PNUM` indexes into for that cell. `TileState` already resolves this correctly by keeping `roomId` and `passageId` as two separate fields instead of one packed nibble -- confirm against `rooms.c`/`passages.c` before relying on this reading |
| `0x10` | `F_REAL` | 16 | `!secret` | Resolved: confirmed in `passages.c` (`putpass()` and `door()` clear `F_REAL` to mark a passage or door as secret, at a probability that increases with depth) and in `move.c` (a levitating player crossing an otherwise-hidden trap gets `F_REAL` set on it, exposing it without triggering it; `numpass()` treats `!(flags & F_REAL)` on a wall character as a secret door). `F_REAL` is uniformly "this feature's true nature is exposed," which is exactly the existing `TileState.secret` field, inverted: `secret === !F_REAL`. No new field needed |
| `0x20` | `F_DROPPED` / `F_LOCKED` (same bit, aliased) | 32 | *(unused)* | Searched `move.c` (trap triggering), `rooms.c` (door placement), and `command.c` (command dispatch, including door interaction) at the pinned commit: neither identifier appears in any of the three. The only state `be_trapped()` was seen setting is `F_SEEN` (discovery, not a sprung/consumed flag); no "already sprung" guard was found anywhere checked. Treat both constants as vestigial/dead in this codebase; no `TileState` field is needed unless a later source file (e.g. `trap`-adjacent code inside another module not yet read) contradicts this. This is an absence-of-evidence conclusion, not a positive one |
| `0x40` | `F_SEEN` | 64 | `discovered` | |
| `0x80` | `F_PASS` | 128 | *(implicit in `terrain === 'passage'`, and disambiguates `F_PNUM` above)* | |

### 4.8 `struct obj_info` -> split across `ItemDefinition` and `IdentificationEntry`

| C field | Target |
| --- | --- |
| `oi_name` | `ItemDefinition` internal/true name (immutable) |
| `oi_prob` | `ItemDefinition` generation weight |
| `oi_worth` | `ItemDefinition` base value |
| `oi_guess` | `IdentificationEntry.called` |
| `oi_know` | `IdentificationEntry.known` |

The C struct stores immutable definition data and mutable per-game identification state in the same array, because the original process only ever runs one game. Section 3 already separates these into `ItemDefinition` (static) and `IdentificationEntry` (per-game), which is the correct split -- this row exists to make the exact field correspondence explicit for whoever transcribes the actual `info[]` tables from `things.c`/`init.c`.

Resolved: `ISKNOW` also exists as a per-*instance* `ItemFlag` (4.6/4.14, `o_flags`) alongside the per-*type* `oi_know`, and rings genuinely use the instance form. Confirmed in `rings.c`'s `ring_num()`, which gates the ring's true name on `obj->o_flags & ISKNOW` -- a check against the specific object, not a shared type-level table. This means ring identification cannot be modeled purely with `IdentificationEntry.known` the way potions and scrolls are: a ring only becomes individually known (by a scroll of identify, or by wear-based discovery elsewhere in `rings.c` not covered by this excerpt), so its `ItemState.flags` must carry `ItemFlag.IsKnown` per instance, and any UI/observation check for "is this ring identified" must read the instance flag rather than (or in addition to) `IdentificationEntry.known` for its `definitionId`. `ItemState.flags: number` (section 3) already has room for this; no structural change was needed, only this clarification. Verify whether sticks behave the same way when `sticks.c` is read.

### 4.9 `struct monster` -> `MonsterDefinition`

Exact match already in section 3: `m_name` -> `name`, `m_carry` -> `carryChance`, `m_flags` -> `flags`, `m_stats` -> `baseStats`.

### 4.10 `struct delayed_action` -> `ScheduledEntry`

| C field | Target | Notes |
| --- | --- | --- |
| `d_type` | `effect` | Was a raw type tag; replaced by the closed `EffectId` registry |
| `d_func` | *(dropped)* | Function pointer; replaced entirely by `EffectId` + registry indirection, per design.md's rule against callbacks in saved state |
| `d_arg` | `arg` | |
| `d_time` | `phase` + `remaining` | Source encodes both in one field (a permanent daemon vs. a positive fuse countdown); `ScheduledEntry` already splits this into two named fields, matching the existing `remaining: -1` daemon / positive fuse convention in section 8 |

### 4.11 `STONE` -> ring appearance pool and per-game worth

`st_name` / `st_value` are a `{name, value}` pair. Confirmed in `init.c`: a 26-entry `stones[]` table (e.g. `{"agate", 25}`, `{"alexandrite", 40}`, ..., `{"zircon", 80}`) is shuffled at startup by `init_stones()`, which assigns each selected stone's `st_name` to that ring's `r_stones[i]` appearance slot **and adds `st_value` into `ring_info[i].oi_worth`**. Both fields are live, not vestigial: `st_name` folds into `IdentificationEntry.appearanceId` as expected, but `st_value` means a ring's identified price is partly random per game, not purely a static `ItemDefinition` figure -- see the `IdentificationEntry.worth` field added in section 3, which is populated the same way (at generation time, alongside `appearanceId`) for definitions whose price is randomized this way. `ItemDefinition`'s own base value stays the source's nominal figure for content that isn't randomized this way (potions, scrolls, weapons, armor). Sticks were not checked directly; verify whether `ws_made[]` (stick appearance names, seen referenced in `things.c`) has an equivalent worth-shuffling step in `sticks.c`/`init.c` before assuming sticks use only a static value.

### 4.12 `struct h_list` -> out of scope

The `'?'` command's help listing (`h_ch`, `h_desc`, `h_print`). This is static UI text for a terminal help screen, not domain state. If reproduced, it belongs as static data in `src/app/`, not in `GameState`.

### 4.13 Screen glyph constants -> `Terrain` / `category` correspondence

| Glyph constant | Char | `Terrain` / `category` value |
| --- | --- | --- |
| `PASSAGE` | `#` | `'passage'` |
| `DOOR` | `+` | `'door'` |
| `FLOOR` | `.` | `'floor'` |
| `PLAYER` | `@` | *(not a tile; player position)* |
| `TRAP` | `^` | `feature.kind === 'trap'` |
| `STAIRS` | `%` | `feature.kind === 'stairs'` |
| `GOLD` | `*` | `category: 'gold'` |
| `POTION` | `!` | `category: 'potion'` |
| `SCROLL` | `?` | `category: 'scroll'` |
| `FOOD` | `:` | `category: 'food'` |
| `WEAPON` | `)` | `category: 'weapon'` |
| `ARMOR` | `]` | `category: 'armor'` |
| `AMULET` | `,` | `category: 'amulet'` |
| `RING` | `=` | `category: 'ring'` |
| `STICK` | `/` | `category: 'stick'` |
| `MAGIC` | `$` | Generic "this is magic" indicator used by some detection effects, not a category of its own |

### 4.14 Flag constants

Transcribe these as named TypeScript constants; do not invent conflicting bit assignments (section 3 already requires this). `RoomFlag` is shown for provenance only -- `RoomState` decomposes it into `dark`/`kind` rather than keeping a raw bitmask, unlike the other three tables below.

```typescript
// r_flags (decomposed into RoomState.dark / RoomState.kind, not kept as a raw field)
const enum RoomFlag {
  IsDark = 0o1,  // ISDARK
  IsGone = 0o2,  // ISGONE
  IsMaze = 0o4,  // ISMAZE
}

// o_flags -> ItemState flags (all variants)
const enum ItemFlag {
  IsCursed = 0o1,     // ISCURSED
  IsKnown  = 0o2,     // ISKNOW -- see 4.8 for the per-type vs per-instance nuance
  IsMissile = 0o4,    // ISMISL (thrown weapon)
  IsMany   = 0o10,    // ISMANY (stackable)
  IsFound  = 0o20,    // ISFOUND (already reported once)
  IsProtected = 0o40, // ISPROT (rust-proof)
}

// t_flags -> MonsterState.flags and PlayerState.flags
// Several bits are reused with a different meaning depending on which
// interface holds them (they are separate fields on separate structs,
// never actually read across kinds -- but the source shares one bit
// range for both, so the reuse is intentional, not a collision).
const enum CreatureFlag {
  CanHallucinateVictim = 0o1,      // CANHUH
  CanSee               = 0o2,      // CANSEE
  IsBlind              = 0o4,      // ISBLIND
  IsCancelled          = 0o10,     // ISCANC  (monster)
  IsLevitating         = 0o10,     // ISLEVIT (player -- same bit as IsCancelled)
  IsFound              = 0o20,     // ISFOUND
  IsGreedy             = 0o40,     // ISGREED
  IsHasted             = 0o100,    // ISHASTE
  IsTarget             = 0o200,    // ISTARGET
  IsHeld               = 0o400,    // ISHELD
  IsConfused           = 0o1000,   // ISHUH
  IsInvisible          = 0o2000,   // ISINVIS
  IsMean               = 0o4000,   // ISMEAN  (monster)
  IsHallucinating      = 0o4000,   // ISHALU  (player -- same bit as IsMean)
  IsRegenerating       = 0o10000,  // ISREGEN
  IsRunning            = 0o20000,  // ISRUN
  SeesMonsters         = 0o40000,  // SEEMONST (player)
  IsFlying             = 0o40000,  // ISFLY    (monster -- same bit as SeesMonsters)
  IsSlowed             = 0o100000, // ISSLOW
}

// PLACE.p_flags -- see 4.7 for the two unresolved bits (F_REAL, F_DROPPED/F_LOCKED)
const enum TileFlag {
  Passage   = 0x80, // F_PASS
  Seen      = 0x40, // F_SEEN
  Dropped   = 0x20, // F_DROPPED / F_LOCKED (aliased)
  Real      = 0x10, // F_REAL
  IndexMask = 0x0f, // F_PNUM
  TrapMask  = 0x07, // F_TMASK
}
```

### 4.15 Content-type unions

Transcribed in source declaration order for provenance; the order has no runtime meaning once each maps to a string `definitionId` (4.6's `o_which` note). Effects, exact names, and which entries are implemented in the `slice` ruleset are separate work (section 17 checklist: `potions.c`, `scrolls.c`, `weapons.c`, `armor.c`, `rings.c`, `sticks.c`).

| # | C constant | Proposed `PotionKind` |
| --- | --- | --- |
| 0 | `P_CONFUSE` | `confuse` |
| 1 | `P_LSD` | `hallucinate` |
| 2 | `P_POISON` | `poison` |
| 3 | `P_STRENGTH` | `strength` |
| 4 | `P_SEEINVIS` | `seeInvisible` |
| 5 | `P_HEALING` | `healing` |
| 6 | `P_MFIND` | `monsterDetection` |
| 7 | `P_TFIND` | `treasureDetection` |
| 8 | `P_RAISE` | `raiseLevel` |
| 9 | `P_XHEAL` | `extraHealing` |
| 10 | `P_HASTE` | `haste` |
| 11 | `P_RESTORE` | `restoreStrength` |
| 12 | `P_BLIND` | `blindness` |
| 13 | `P_LEVIT` | `levitation` |

| # | C constant | Proposed `ScrollKind` |
| --- | --- | --- |
| 0 | `S_CONFUSE` | `confuse` |
| 1 | `S_MAP` | `magicMapping` |
| 2 | `S_HOLD` | `holdMonster` |
| 3 | `S_SLEEP` | `sleep` |
| 4 | `S_ARMOR` | `enchantArmor` |
| 5 | `S_ID_POTION` | `identifyPotion` |
| 6 | `S_ID_SCROLL` | `identifyScroll` |
| 7 | `S_ID_WEAPON` | `identifyWeapon` |
| 8 | `S_ID_ARMOR` | `identifyArmor` |
| 9 | `S_ID_R_OR_S` | `identifyRingOrStick` |
| 10 | `S_SCARE` | `scareMonster` |
| 11 | `S_FDET` | `foodDetection` |
| 12 | `S_TELEP` | `teleportation` |
| 13 | `S_ENCH` | `enchantWeapon` |
| 14 | `S_CREATE` | `createMonster` |
| 15 | `S_REMOVE` | `removeCurse` |
| 16 | `S_AGGR` | `aggravateMonsters` |
| 17 | `S_PROTECT` | `protectArmor` |

Resolved: confirmed in `scrolls.c`. `S_ARMOR` ("scroll of enchant armor") removes any curse on the equipped armor and decrements `o_arm` by 1, improving armor class (lower is better in this source's convention). `S_ENCH` ("scroll of enchant weapon") removes any curse on the equipped weapon and randomly increments either its hit bonus (`o_hplus`) or its damage bonus (`o_dplus`). Both are enchantment scrolls, one per equipment slot; named accordingly above.

| # | C constant | Proposed `WeaponKind` |
| --- | --- | --- |
| 0 | `MACE` | `mace` |
| 1 | `SWORD` | `sword` |
| 2 | `BOW` | `bow` |
| 3 | `ARROW` | `arrow` |
| 4 | `DAGGER` | `dagger` |
| 5 | `TWOSWORD` | `twoHandedSword` |
| 6 | `DART` | `dart` |
| 7 | `SHIRAKEN` | `shuriken` |
| 8 | `SPEAR` | `spear` |

`MAXWEAPONS = 9` matches the 9 rows above. Resolved: the header also defines a stray `FLAME` constant at value 9 (past `MAXWEAPONS`), but it does not appear in `weapons.c`'s `init_dam` table, nor anywhere in `extern.c` or `fight.c`. `FLAME` is vestigial/unused in this codebase's actual game logic; exclude it from `WeaponKind`, which stands at exactly the 9 entries above.

| # | C constant | Proposed `ArmorKind` |
| --- | --- | --- |
| 0 | `LEATHER` | `leather` |
| 1 | `RING_MAIL` | `ringMail` |
| 2 | `STUDDED_LEATHER` | `studdedLeather` |
| 3 | `SCALE_MAIL` | `scaleMail` |
| 4 | `CHAIN_MAIL` | `chainMail` |
| 5 | `SPLINT_MAIL` | `splintMail` |
| 6 | `BANDED_MAIL` | `bandedMail` |
| 7 | `PLATE_MAIL` | `plateMail` |

| # | C constant | Proposed `RingKind` |
| --- | --- | --- |
| 0 | `R_PROTECT` | `protection` |
| 1 | `R_ADDSTR` | `addStrength` |
| 2 | `R_SUSTSTR` | `sustainStrength` |
| 3 | `R_SEARCH` | `search` |
| 4 | `R_SEEINVIS` | `seeInvisible` |
| 5 | `R_NOP` | `noOp` (a deliberate dud ring type in the source) |
| 6 | `R_AGGR` | `aggravateMonsters` |
| 7 | `R_ADDHIT` | `addHit` |
| 8 | `R_ADDDAM` | `addDamage` |
| 9 | `R_REGEN` | `regeneration` |
| 10 | `R_DIGEST` | `digestion` |
| 11 | `R_TELEPORT` | `teleportation` |
| 12 | `R_STEALTH` | `stealth` |
| 13 | `R_SUSTARM` | `sustainArmor` |

| # | C constant | Proposed `StickKind` |
| --- | --- | --- |
| 0 | `WS_LIGHT` | `light` |
| 1 | `WS_INVIS` | `invisibility` |
| 2 | `WS_ELECT` | `lightning` |
| 3 | `WS_FIRE` | `fire` |
| 4 | `WS_COLD` | `cold` |
| 5 | `WS_POLYMORPH` | `polymorph` |
| 6 | `WS_MISSILE` | `magicMissile` |
| 7 | `WS_HASTE_M` | `hasteMonster` |
| 8 | `WS_SLOW_M` | `slowMonster` |
| 9 | `WS_DRAIN` | `drainLife` |
| 10 | `WS_NOP` | `noOp` |
| 11 | `WS_TELAWAY` | `teleportAway` |
| 12 | `WS_TELTO` | `teleportTo` |
| 13 | `WS_CANCEL` | `cancellation` |

### 4.16 Trap kind cross-check

`T_DOOR`, `T_ARROW`, `T_SLEEP`, `T_BEAR`, `T_TELEP`, `T_DART`, `T_RUST`, `T_MYST` (`NTRAPS = 8`) already match the `TrapKind` union in section 3 one-for-one (`trapDoor`, `arrow`, `sleep`, `bear`, `teleport`, `dart`, `rust`, `mystery`) -- confirmed consistent, no changes needed.

### 4.17 Source verification findings

The six items flagged as gaps in an earlier pass of this document were checked against `move.c`, `passages.c`, `rooms.c`, `command.c`, `rings.c`, `scrolls.c`, `weapons.c`, `things.c`, `extern.c`, `fight.c`, `chase.c`, `monsters.c`, and `init.c` at the pinned commit. Outcomes:

| Item | Outcome |
| --- | --- |
| `MonsterState` missing `roomId` (`t_room`) | Fixed: field added in section 3. Confirmed set in `new_monster()`/`relocate()`, read in `do_chase()`/`find_dest()` (4.5) |
| `PLACE` `F_REAL` semantics | Resolved: `F_REAL` is the inverse of the already-existing `TileState.secret` field; no new field needed (4.7) |
| `PLACE` `F_DROPPED`/`F_LOCKED` semantics | Resolved as unused: not found in `move.c`, `rooms.c`, or `command.c`; treated as vestigial constants (4.7) |
| Per-instance vs per-type ring identification | Resolved: rings use the per-instance `ISKNOW` object flag (`ItemState.flags`), confirmed in `rings.c`; `IdentificationEntry.known` alone is not sufficient for rings (4.8) |
| `o_text` per-instance vs shared | Resolved: scroll titles are read from a shared `s_names[which]` array, not `o_text`; no `ItemState` field needed (4.6) |
| `FLAME` weapon constant | Resolved as unused: absent from `weapons.c`, `extern.c`, and `fight.c` (4.15) |
| `STONE.st_value` purpose | Resolved: feeds `ring_info[i].oi_worth` in `init_stones()`, confirmed in `init.c`. This surfaced a new modeling requirement (ring worth is partly per-game random), addressed by the `IdentificationEntry.worth` field added in section 3 (4.11) |

Two residual items surfaced by this pass, not yet closed:

- Whether sticks share rings' per-instance identification and worth-randomization behavior (`sticks.c` not yet read).
- Whether a trap "already sprung" concept exists anywhere outside the three files checked for `F_DROPPED`/`F_LOCKED`; the conclusion above is an absence-of-evidence result, not a positive one.

Add a rules-ledger row before implementing content that depends on either.

## 5. Randomness and numerical behavior

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

## 6. Public session and transaction boundary

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

## 7. Command-cycle state machine

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

## 8. Scheduler implementation

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

## 9. Entities, stacking, and indexes

`buildIndexes(state)` creates monster-by-cell, object-by-cell, and entity lookup helpers. Player occupancy is separate. A tile can hold a monster over an object. Initial source rules permit at most one floor object entity per cell; a quantity stack is one entity. Index validation rejects overlap rather than overwriting an entry.

Implement `allocateId`, `insertMonster`, `insertItem`, `transferItem`, `splitStack`, `mergeStacks`, `destroyItem`, and `destroyMonster`. All call sites use these functions for ownership/order changes. A transfer validates destination before removing the item from its source. Stack merging uses source `pack.c` compatibility, including grouping and enchantments, not category alone. Destroy the merged-away ID and emit its replacement ID for UI selection cleanup.

`drop` follows source stack-selection behavior; the initial action deliberately has no arbitrary quantity field. Throw/use can detach one unit using `splitStack` when the source does so. Equipped-item removal checks curses before altering the pack. Gold collection increments purse then destroys the floor entity. Death detaches carried items according to source fall/drop placement before removing the monster; do not regenerate all loot at death.

Maintain order arrays using the equivalent of source attach/detach operations. These arrays are validated serialized order, since changing iteration order can change AI and random outcomes. On a level transition, delete floor objects, monsters, and their packs; retain player-owned items and monotonic ID allocation.

## 10. Generation pipeline

Implement `buildLevel(context, depth): LevelState` as part of the same transactional state, using the shared RNG and entity allocator. Reproduce the order in `new_level.c`: clear held state; update maximum depth; clear old level objects and monsters; `do_rooms`; `do_passages`; increment no-food counter; `put_things`; traps; stairs; monster room assignment; player placement; room entry observation.

Port room placement from `rooms.c`, including gone/dark/maze flags, room population, and gold targeting. Port graph construction and tunnel carving from `passages.c`; use explicit typed edge records in place of pointer arithmetic. Assign passage membership using source connectivity behavior. Keep temporary generator bookkeeping local unless it affects future generations; any persistent source static must be moved into saved state or reset by an explicit documented policy.

Represent generation stages as trace events in debug mode. A seed fixture must report which stage first diverged. Do not silently regenerate until a map looks acceptable: this changes RNG consumption and can hide bugs. Bound pathological placement loops with a diagnostic fault, identifying the seed and stage.

Connectivity tests use potential traversability, including secret passages, rather than requiring every hidden connection to be immediately walkable. Also verify valid player/stairs placement, nine room slots, unique entity IDs, and consistent floor occupancy. Use fixed seeds and depth-specific fixtures; do not assert that every slot contains an ordinary room.

## 11. Movement and combat algorithms

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

## 12. Monster and item modules

Port `runners`, chase decisions, and source target updates without replacing them with A* pathfinding. Iterate `monsterOrder` in source-equivalent order. Before processing each ID, confirm it still exists; removal, teleport, and death can invalidate later assumptions. Movement uses the same occupancy helpers but source-specific monster predicates. Sleep, slow/haste, held behavior, and disguise belong to rules, not animation state.

Each item category exports a handler accepting the already committed item and target. Validation checks player ownership, category, equipment constraints, charges, and target requirements before resolving effects. Identification changes are emitted separately from consumption. Unsupported target-dependent effects fail before consuming an item.

Some scroll effects require another item selection. The first UI slice gathers all required parameters before commit when the item is known. For unknown effects that request a choice only after activation, implement a serialized pending-decision state before enabling that content: action activation, decision prompt, response, and cancellation consequences must follow the source. Do not identify the scroll in the UI merely to preselect a target. Such effects are excluded from slice generation until that extension and replay coverage exist.

For each content category, transcribe definition data separately from runtime effects. Each definition includes `sourceFile`, `sourceSymbol`, stable ID, appearance category, initial generation data, and handler ID. A startup coverage check requires every enabled definition to have a handler. No reflection or dynamically evaluated handler names.

## 13. Perception, memory, and event privacy

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

## 14. Persistence and replay

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

## 15. Browser shell and renderer

`AppController` owns one session, one replay recorder, one input controller, and one renderer. Startup creates the DOM, attempts saved-game restoration, otherwise creates the fixed default seed game. A failed autosave import offers a new game while retaining the invalid file for manual export; never trap the user in a startup loop.

Input states are `idle`, `inventory`, `chooseDirection`, `chooseItem`, `busy`, and `replay`. Escape clears an uncommitted UI choice. Store selected observation token with its revision; map to an engine item ID only in the controller. Revalidate on commit. Ignore repeat keydown and shortcuts from editable targets. Give the canvas a focusable container and visible focus indicator.

For player inventory, the token may equal its stable item ID: possession already permits selection. Visible-world tokens must not encode hidden definition names. A target action uses direction initially, avoiding an API that lets a guessed hidden monster ID become a valid attack. Debug entities are never added to the controller's selectable inventory mapping.

Dispatch sequence: resolve UI intent -> snapshot revision -> mark busy -> submit -> update observation and player log -> record detached replay state/hash -> request autosave -> render -> release busy. Storage failure does not roll back gameplay. Animation completion does not call the engine. New-game/load/replay controls cannot swap the session in the middle of this sequence.

Canvas layout: compute `cellSize = floor(min(availableWidth / width, availableHeight / height))`, clamped to at least 1 CSS pixel; center the map and use scrolling at small sizes if needed. Size the backing buffer using devicePixelRatio, then scale the context once. Hit testing subtracts the canvas bounding rectangle and centered offset, divides by CSS cell size, floors, and checks bounds. Do not apply devicePixelRatio twice. Resize changes only view parameters.

Draw layers in order: unknown background, remembered terrain, visible terrain/features, observed objects/monsters, player, selected-cell outline, optional debug overlay. Initial rendering uses glyphs and flat colors. Keep an adjacent text description for selection and a bounded DOM message log. Whole-map redraw is acceptable for 1,920 cells; do not add dirty-region complexity initially.

The inspector reads detached debug snapshots and renders explicit fields. A raw JSON section is collapsible. Clicking the inspector cannot dispatch gameplay. Replay controls use the same renderer but disable live gameplay input. Do not poll engine state every animation frame; render from the last observation.

## 16. Desktop 3D and XR extension contract

Presentation reference: [Quick 3D MMORPG review](quick-3d-mmorpg-review.md), pinned to `547884332ca650abe96264f7230702d36481b9bc`. Adapt camera smoothing, animation crossfades, and skeleton-aware asset instancing; do not import its render-driven gameplay, networking, or Three.js-backed entity state.

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

For the desktop adapter, bind input listeners with removable callbacks and clear captured input on blur, visibility loss, and disposal. Ray selection uses distance-sorted eligible observed objects and an explicit occlusion rule. Cache assets by resolved URL plus load options, with explicit loading/ready/failed states. Animation states consume resolved presentation events; animation completion only releases presentation resources or advances its visual queue.

Resource cleanup handles material arrays and reference-counted shared textures/geometries. Late loader results must check the active view token before attachment. Test same-filename assets from different paths, disposal during load, surviving shared instances, nearest-hit selection, and repeated view mounting. Do not globally disable frustum culling as a substitute for inspecting animated bounds.

## 17. Source-to-module implementation checklist

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

## 18. Concrete acceptance cases

| ID | Setup/action | Expected assertion |
| --- | --- | --- |
| R01 | RNG word 1 | First three outputs match section 5 |
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

## 19. Code generation work packages

1. **Scaffold and model:** configs, scripts, types, flags, definition manifest, RNG, grid helpers, state validator. Gate: typecheck, R01/R02, invalid-state tests. Produce no placeholder gameplay claims.
2. **State operations and scheduler:** entity transfers/indexes, scheduler, draft transaction, cycle machine with fixtures. Gate: T01–T07, I01/I02, rollback tests.
3. **Generation:** port initialization and dungeon stages with source table attribution. Gate: deterministic seeds, occupancy/connectivity invariants, L01 fixture.
4. **Playable rules:** movement, rest/search, combat, basic inventory, effects and monster behavior for enabled slice definitions. Gate: M/C/I tests and no missing enabled handlers.
5. **Browser 2D:** shell, input, map, messages, inspector and reveal. Gate: B01–B03 and P01/P02; a user can start, move, fight, inspect, and descend without a headset.
6. **Persistence:** validated saves, IndexedDB, manual files, replay and export. Gate: S01–S03/B04, including haste and forced-turn continuation.
7. **Full content:** port remaining definitions/effects and pending decisions, expand schema and replay deliberately. Gate: coverage manifest complete before enabling full mode.
8. **Desktop 3D, then XR:** implement view contract and resource lifecycle. Gate: identical engine replay hashes across views; no engine imports from Three.js/WebXR.

For each package, generate code and focused tests together, run its gates, update the rules ledger with actual status, then continue. Do not stub an unimplemented rule with success. Do not describe the full port as complete when only the browser slice is playable.
