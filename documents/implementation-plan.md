# Implementation plan

Status: implementation complete through Phase 10. This plan breaks the [TypeScript implementation specification](typescript-implementation.md) into small reviewable changes. The reference remains Davidslv/rogue commit `f4653c2a2ee6981a73abe9dfda055134285e1e79`.

## Working method

- Work in step order unless a dependency is explicitly identified otherwise. Complete and verify one step before starting its dependents.
- Aim for one coherent change per step. If a step requires unrelated modules or multiple source subsystems, split it into lettered substeps before coding. Full-content steps below are queues of such changes, not single large commits.
- Read the relevant pinned source functions, record mappings and intentional differences in the rules ledger, implement the smallest behavior, and add its focused verification.
- Run type checking and relevant tests for code changes. Run build and browser smoke checks at each browser-facing phase gate. Add broader tests only when the change warrants them.
- Update each checkbox only after its completion check passes. Record the implementing commit and validation result in a short phase completion note. Commit completed steps when authorized; do not infer a request to publish from this plan.
- Fixtures are explicit debug scenarios. They must not masquerade as generated games or imply that unsupported mechanics work. Keep slice/full capability manifests accurate.

This plan brings a fixture-based browser view forward so visual debugging starts early. It also implements manual saves before full content. These are scheduling refinements to the specification's work packages, not changes to engine boundaries or rules.

## Phase 0 — Establish a runnable project

Outcome: a regular browser opens the application shell; engine code can be tested without a browser.

| Step | Small deliverable | Completion check |
| --- | --- | --- |
| 0.1 | Add package manifest, pinned dependencies, lockfile, Vite, TypeScript configurations, and scripts. | `typecheck` and `build` pass; development URL opens. |
| 0.2 | Add engine/browser source folders, Vitest, and one meaningful boundary check forbidding browser imports in engine. | Headless tests run with no DOM; importing presentation from engine fails the check. |
| 0.3 | Add the basic DOM shell with map host, message area, and disabled controls for unavailable capabilities. | Browser smoke test opens without WebXR; no startup errors. |
| 0.4 | Record source revision, source-to-module tracking format, and applicable notices for code being reused. | Source provenance is documented and generated code has a defined attribution location. |

- [ ] 0.1
- [ ] 0.2
- [ ] 0.3
- [ ] 0.4

Gate: runnable shell and headless verification. Do not add gameplay yet.

## Phase 1 — Deterministic state primitives

Outcome: a small dungeon fixture exists as validated data with predictable randomness.

| Step | Small deliverable | Completion check |
| --- | --- | --- |
| 1.1 | Position, tile, room, player, and entity types; grid indexing and bounds helpers. | Edge cells and invalid coordinates are handled without out-of-range access. |
| 1.2 | Implement specified RNG and dice helpers. | R01/R02 vectors and draw counts pass. |
| 1.3 | Implement monotonic entity IDs and occupancy indexes. | Monster and object coexist on a cell; duplicate occupancy is rejected (I01). |
| 1.4 | Implement ownership transfer and ordered containers, without stacking yet. | Transfer preserves one owner; failed transfer leaves source unchanged. |
| 1.5 | Add a two-room fixture builder and initial structural validator. | Fixture validates; corrupted IDs, positions, and ownership are rejected. |

- [x] 1.1
- [x] 1.2
- [x] 1.3
- [x] 1.4
- [x] 1.5

Completed 2026-09-10. Validation at completion: TypeScript checks and production build passed; Phase 1 primitive/validation cases are included in the 30-test suite reported under Phase 2.

Gate: fixtures are deterministic and structurally valid. Extend validation as later schema fields appear rather than pretending the initial validator covers the full game.

## Phase 2 — See and inspect a fixture in the browser

Outcome: the user can inspect a map before game simulation is implemented.

| Step | Small deliverable | Completion check |
| --- | --- | --- |
| 2.1 | Define observation snapshots and a fixture-only projection with explicit visibility data. | Unknown cells contain no hidden labels or entities. |
| 2.2 | Draw the observation with Canvas 2D. | Map matches fixture; browser needs no XR APIs. |
| 2.3 | Add resize handling and cell hit testing. | Selection remains correct at multiple viewport sizes and devicePixelRatio values (B03). |
| 2.4 | Add read-only selected-cell inspector and visibly marked debug reveal overlay. | Repeated inspection and reveal leave fixture state and RNG unchanged (P02). |

- [x] 2.1
- [x] 2.2
- [x] 2.3
- [x] 2.4

Completed 2026-09-10. Validation at completion: 30 tests passed, TypeScript checks and production build passed, and the browser was manually checked for visible-cell inspection, the marked reveal overlay, hidden entity inspection, and browser console errors.

Gate: inspectable fixture. The fixture projector is not yet a claim of source-compatible visibility; replace it with the rules projector in Phase 5.

## Phase 3 — Correct command timing

Outcome: rest and free commands can be stepped and traced with correct cycle boundaries.

| Step | Small deliverable | Completion check |
| --- | --- | --- |
| 3.1 | Add action requests/results, revision checking, draft transactions, and commit/rollback. | Stale request does nothing; internal failure rolls back; rule rejection is recorded correctly. |
| 3.2 | Implement daemon/fuse allocation, lookup, removal, and live-slot execution. | T05/T06 plus full-slot fault tests pass. |
| 3.3 | Implement normal cycle phases and rest using test effect handlers. | T01/T03 trace expectations pass; free actions do not rerun BEFORE. |
| 3.4 | Add hasted slots and forced no-command advancement. | T02/T07 pass; no browser input required during forced turns. |
| 3.5 | Expose input-ready session snapshots and a debug phase trace in the browser. | One rest press produces one expected resolution; UI inspection never advances simulation. |

- [x] 3.1
- [x] 3.2
- [x] 3.3
- [x] 3.4
- [x] 3.5

Completed 2026-09-10. Validation at completion: 41 tests passed, TypeScript checks and production build passed, and a browser smoke check confirmed that one Rest click advanced tick/revision once and displayed the expected action, AFTER, ring, next BEFORE, and input-ready trace.

Gate: timing state machine passes headless tests. Test callbacks remain fixture-only; production effects are added later. Save-between-haste test T04 waits for Phase 6.

## Phase 4 — Move around the fixture

Outcome: keyboard movement works in a regular browser, with visible rule outcomes.

| Step | Small deliverable | Completion check |
| --- | --- | --- |
| 4.1 | Port terrain stepping and diagonal legality from selected source. | Bounds, cardinal movement, and M01 pass; no Clone III rule substitutions. |
| 4.2 | Implement ordinary movement, blocked movement, and movement events. | Position and indexes agree; blocked moves preserve the action slot. |
| 4.3 | Add desktop movement/rest input, focus handling, and key-repeat suppression. | B02 passes; one intentional key press submits one action. |
| 4.4 | Implement room/passage transitions and deferred pickup hook without item behavior yet. | Crossing a door updates logical region; no renderer mutation is required. |
| 4.5 | Add confusion and no-move fixture behavior. | M02/M03 pass, including retained random draws on free confused moves. |

- [x] 4.1
- [x] 4.2
- [x] 4.3
- [x] 4.4
- [x] 4.5

Completed 2026-09-10. Validation at completion: 50 tests passed, TypeScript checks and production build passed. Browser smoke checks confirmed a keyboard move advanced exactly one tick/revision and that movement keys are ignored while a control has focus.

Gate: walkable debug fixture with reliable timing. Unavailable interactions are explicitly disabled or rejected.

## Phase 5 — Player knowledge and hidden information

Outcome: the normal map displays what the player knows; reveal stays separate.

| Step | Small deliverable | Completion check |
| --- | --- | --- |
| 5.1 | Port ordinary room/passage visibility and remembered terrain; replace fixture-only projection for gameplay. | Enter/leave fixtures match source-derived expectations. |
| 5.2 | Implement hidden doors/traps and search discovery. | Searching follows source probabilities and slot policy; hidden features remain hidden until discovered. |
| 5.3 | Add event-time safe presentation messages separately from raw debug events. | P01 passes with a fixture actor moving while unseen. |
| 5.4 | Add blind/detection/disguise projection cases as explicit fixtures; enable only supported statuses. | Observation does not leak true identity or unexplored geometry. |

- [x] 5.1
- [x] 5.2
- [x] 5.3
- [x] 5.4

Completed 2026-09-11. Validation at completion: 56 tests passed, TypeScript checks and production build passed. Browser smoke checks confirmed Search consumes one turn, safe movement feedback contains no raw coordinates, and raw actor IDs/positions appear only inside the enabled DEBUG REVEAL panel.

Gate: observation reads are pure and normal events do not reveal hidden state. Hallucination and other unimplemented full-content effects remain disabled until Phase 11.

## Phase 6 — Manual saves and basic reproduction

Outcome: every subsequent gameplay bug can be reproduced from a saved state and actions.

| Step | Small deliverable | Completion check |
| --- | --- | --- |
| 6.1 | Add save envelope, full validation for currently implemented state, and restore factory. | Invalid candidate never replaces live session; duplicate ownership rejected (S02). |
| 6.2 | Preserve pending cycle, scheduler, RNG, knowledge, and counters. | Save between hasted actions and after forced turns matches uninterrupted continuation (T04). |
| 6.3 | Add canonical serialization and SHA-256 adapter. | Canonicalization fixture matches headless/browser results. |
| 6.4 | Record accepted requests, rejected rule actions, and expected hashes; replay headlessly. | Rest/move/search sequence reproduces every checksum. |
| 6.5 | Add manual download/upload and a minimal export-bug-report button. | Fresh browser session imports and reproduces the fixture report. |

- [x] 6.1
- [x] 6.2
- [x] 6.3
- [x] 6.4
- [x] 6.5

Completed 2026-09-11. Validation at completion: 63 tests passed, TypeScript checks and production build passed. Browser smoke checks recorded an action hash and downloaded both the manual save and replay bug report; the same report parser/reproduction path was verified headlessly through every expected checksum.

Gate: manual save and reproduction work before adding more rules. This checkpoint is a development tool, not a complete persistence UI.

## Phase 7 — Combat and one active monster

Outcome: the user can fight and defeat a representative monster in the browser.

| Step | Small deliverable | Completion check |
| --- | --- | --- |
| 7.1 | Transcribe required combat/strength tables and one monster definition; parse source damage groups. | Malformed definitions fail; source values and parser cases are verified. |
| 7.2 | Implement hit calculation and natural melee damage. | C01/C02 pass with scripted RNG. |
| 7.3 | Add bump attack, HP events, monster/player death, and terminal state handling. | Attack does not move player into monster; death stops later effects. |
| 7.4 | Port ordinary monster movement, target behavior, and runners scheduling for that species. | Monster acts at correct cycle phase; blocked path and sleeping fixtures match source. |
| 7.5 | Add carried-item release on death using fixture items. | Released item retains identity and valid ownership; old monster references are removed. |
| 7.6 | Add browser encounter fixture and replay regression. | Win/lose encounter produces identical save/replay results. |

- [x] 7.1
- [x] 7.2
- [x] 7.3
- [x] 7.4
- [x] 7.5
- [x] 7.6

Gate: one end-to-end encounter. Do not enable monster species whose special behavior is missing.

## Phase 8 — Inventory and survival slice

Outcome: a small but meaningful set of Rogue interactions works end to end.

| Step | Small deliverable | Completion check |
| --- | --- | --- |
| 8.1 | Gold pickup and purse updates. | Deferred pickup occurs once; collected entity is removed. |
| 8.2 | Source-compatible stack splitting/merging and pack capacity. | I02 and capacity rejection cases pass. |
| 8.3 | Inventory panel, ordinary pickup/drop, selection cancellation. | Cancel spends no slot; controller cannot select debug-only items. |
| 8.4 | Weapon/armor equip and remove, modifiers, and curse restrictions. | I03 and equipped combat/save cases pass. |
| 8.5 | Food use and stomach/hunger effects. | Consumption, thresholds, and forced consequences follow source traces. |
| 8.6 | Doctor/healing and the required timed status recovery handlers. | Saved counters and scheduler produce equal continuation after restore. |
| 8.7 | Implement trap handlers needed by the enabled slice, one trap kind per substep. | Each kind has movement/timing/save fixtures before generation enables it. |

- [x] 8.1
- [x] 8.2
- [x] 8.3
- [x] 8.4
- [x] 8.5
- [x] 8.6
- [x] 8.7

Gate: slice capability manifest is accurate. Extend validation with every new state field; keep older save versions explicitly compatible or explicitly rejected.

## Phase 9 — Seeded generated dungeon

Outcome: replace fixtures with a playable generated dungeon while retaining fixtures for debugging.

| Step | Small deliverable | Completion check |
| --- | --- | --- |
| 9.1 | Port ordinary room placement and flags. | Fixed seed maps are deterministic; bounds and room-slot invariants pass. |
| 9.2 | Port passage graph construction and carving. | Potential traversability connects intended regions, including secrets. |
| 9.3 | Port gone/maze regions and passage membership. | Deep-level fixtures validate without assuming rectangular rooms. |
| 9.4 | Add player/stairs placement and supported population in source pipeline order. | No duplicate occupancy or unsupported generated definitions. |
| 9.5 | Add starting player/pack initialization, appearance setup needed by enabled items, and production scheduler registration. | New game is reproducible and valid at its first input boundary. |
| 9.6 | Implement stairs and level cleanup, including trap-driven changes already enabled. | L01 passes; carried items survive, old floor entities do not, source timing preserved. |
| 9.7 | Connect seed field and New Game to generator; keep explicit fixture selector in debug UI. | User starts and plays a generated level without developer commands. |

- [x] 9.1
- [x] 9.2
- [x] 9.3
- [x] 9.4
- [x] 9.5
- [x] 9.6
- [x] 9.7

Gate: first playable browser slice. Supported-only population is a documented slice deviation; it must not be presented as exact full-source generation. Source-correct full populations are enabled in Phase 11.

## Phase 10 — Complete the browser debugging workflow

Outcome: sustained browser play and bug reporting are practical.

| Step | Small deliverable | Completion check |
| --- | --- | --- |
| 10.1 | Add serialized IndexedDB autosave writes and restore-on-startup. | Storage failure leaves game usable and manual save available (B04). |
| 10.2 | Add replay restart/step/play/pause/speed and live-input locking. | One replay step means one recorded action; controls do not change results. |
| 10.3 | Add bounded log rotation with checkpoint advancement. | S03 passes across multiple rotations. |
| 10.4 | Add event filters, action timing display, and first-divergence reporting. | Report identifies action and hashes without inventing unavailable expected-state differences. |
| 10.5 | Complete browser smoke suite in Chromium and Firefox. | Startup, focus, inventory, load/export, resize, and generated-game smoke checks pass. |

- [x] 10.1
- [x] 10.2
- [x] 10.3
- [x] 10.4
- [x] 10.5

Gate: browser slice is the stable debugging platform for all subsequent work.

Completed 2026-09-12. Validation at completion: 116 headless tests and six Playwright smoke cases passed. The smoke matrix runs startup without WebXR, focused-input isolation, generated inventory, manual load/export, and DPR2 resizing in both Chromium and Firefox.

## Phase 11 — Complete Rogue rules in small content batches

Outcome: the selected source's supported gameplay replaces the limited slice.

Each row is a queue: make one effect, ability, or tightly related group its own implementation step with source mapping, fixtures, and replay coverage. Do not implement an entire content category in one unchecked patch.

| Step | Batch | Completion check |
| --- | --- | --- |
| 11.1 | Finish identification and randomized appearances; add potions individually. | Correct observation, effect duration, consumption, and save continuation for each potion. |
| 11.2 | Add serialized pending decisions and replay responses before target-dependent unknown-item effects. | Save mid-decision; restore and respond; no premature identity leak. |
| 11.3 | Add scroll effects individually. | Selection, cancellation, identification, and world changes match source. |
| 11.4 | Add thrown items, missiles/launchers, and sticks in separate substeps. | Trajectories, damage, charges, and target behavior verified. |
| 11.5 | Add rings individually, including hunger and left/right processing interactions. | Cycle-order and combined-equipment fixtures pass. |
| 11.6 | Add remaining monster species and special abilities individually. | Each enabled species has behavior coverage, including theft/held/drain/disguise cases where applicable. |
| 11.7 | Finish remaining traps, hallucination, detection, and status interactions. | No perception leaks; no rendering-driven RNG; continuation preserved. |
| 11.8 | Add remaining generation content, wandering monsters, treasure behavior, Amulet, ascent, and victory in substeps. | Full-content manifests close; progression and end states tested. |
| 11.9 | Audit commands and options, documenting deferred terminal-only features and intentional browser differences. | Every source command has an implemented, replaced, or explicitly deferred disposition. |

- [ ] 11.1
- [ ] 11.2
- [ ] 11.3
- [ ] 11.4
- [ ] 11.5
- [ ] 11.6
- [ ] 11.7
- [ ] 11.8
- [ ] 11.9

Phase 11.1 progress:

- [x] Add serialized per-type identification state and source-shaped randomized potion colors.
- [x] Add the confusion potion with consumption, identification, duration extension, recovery, browser input, replay, and save continuation.
- [x] Add the poison potion with bounded strength loss, sustain-strength interaction, hallucination cleanup, replay, and save continuation.
- [x] Add the gain-strength potion with base maximum tracking, add-strength ring interaction, replay, and save continuation.
- [ ] Add potion effects individually, including consumption and identification behavior.

Gate: enable `full` mode only after definition coverage and the command audit justify it. Deterministic TypeScript replay is not a claim of identical historical C RNG sequences. Any deferred gameplay command prevents claiming full source parity even if full content is available.

## Phase 12 — Desktop 3D with the same engine

Outcome: room geometry and spatial interaction can be debugged without a headset.

Use the [Quick 3D MMORPG review](quick-3d-mmorpg-review.md) as a selective presentation reference. Keep the headless Rogue engine and existing phase order.

| Step | Small deliverable | Completion check |
| --- | --- | --- |
| 12.1 | Implement GameView contract for existing 2D view and add empty desktop 3D view. | Switching views preserves session and revision. |
| 12.2 | Render primitive floor/wall/door geometry from safe observations. | Layout agrees with 2D; unknown rooms are not revealed. |
| 12.3 | Add desktop look/orbit/tabletop camera controls, smoothing, and nearest eligible ray selection. | Camera motion spends no turns; selection respects occlusion; focus loss clears captured input. |
| 12.4 | Add visible entity representations, independent skeleton instances, and event-driven animation states. | Animation skip/speed does not affect replay hashes; animation callbacks never initiate gameplay. |
| 12.5 | Add local room activation, URL-keyed asset caching, shared-resource ownership, and async generation tokens. | Test same filenames at different paths, material arrays, disposal during load, surviving shared instances, and listener teardown. |

- [ ] 12.1
- [ ] 12.2
- [ ] 12.3
- [ ] 12.4
- [ ] 12.5

Gate: identical action sequences yield identical engine results in 2D and 3D. This phase may start after Phase 10 if the user prioritizes spatial prototyping; full-rule work still remains tracked separately.

## Phase 13 — XR adapter and device verification

Outcome: XR uses the already-debugged browser engine and scene.

| Step | Small deliverable | Completion check |
| --- | --- | --- |
| 13.1 | Add capability detection and optional session entry/exit. | Unsupported browser retains complete desktop functionality. |
| 13.2 | Add tracked camera/controller presentation without gameplay gestures. | Tracking never modifies actor position. |
| 13.3 | Add one discrete locomotion action and rejected-move feedback. | Same engine result as equivalent desktop action. |
| 13.4 | Add selection and attack commitment with debouncing. | One intentional gesture commits one action; stale requests rejected. |
| 13.5 | Add tabletop inspection and scale transition. | No movement bypass or hidden-information reveal. |
| 13.6 | Test comfort, tracking loss, session teardown, and performance on target headset. | Device findings recorded; browser regressions still pass. |

- [ ] 13.1
- [ ] 13.2
- [ ] 13.3
- [ ] 13.4
- [ ] 13.5
- [ ] 13.6

Gate: headset-specific behavior verified on hardware. Browser-only tests cannot close this gate.

## Dependency and milestone summary

```text
0 Scaffold -> 1 State -> 2 Inspectable fixture -> 3 Timing
 -> 4 Movement -> 5 Knowledge -> 6 Save/reproduce
 -> 7 Combat -> 8 Inventory/survival -> 9 Generated game
 -> 10 Stable browser debugger -> 11 Full rules
 -> 12 Desktop 3D -> 13 XR

Optional scheduling: 10 -> 12 for early spatial prototyping.
```

| Milestone | Reached after | What the user can do |
| --- | --- | --- |
| First visible result | Phase 2 | Open and inspect a dungeon fixture in a browser |
| First interaction | Phase 4 | Walk through the fixture with keyboard controls |
| First reproducible bug | Phase 6 | Save/export and reproduce an action sequence |
| First encounter | Phase 7 | Fight a monster and inspect the outcome |
| First playable generated slice | Phase 9 | Start a seeded game, explore, fight, manage basic items, change levels |
| Stable development platform | Phase 10 | Debug and replay gameplay through a complete browser workflow |
| Full-content candidate | Phase 11 | Exercise implemented source content and audit remaining differences |
| Spatial browser version | Phase 12 | Explore the same game in desktop 3D |
| XR version | Phase 13 | Use a headset with verified input and presentation |

The next implementation task is **7.1 only**: transcribe the required combat and strength tables plus one monster definition from the pinned source.
