# FreeBSD Rogue source review

Historical comparison only: the project subsequently selected Davidslv Rogue 5.4.4 as its base. See [selected source notes](rogue544-base.md) and [current design](design.md). Clone III-specific recommendations below do not govern the selected port.

Reviewed 2026-09-10 against FreeBSD `releng/4.11`, `games/rogue`, downloaded from the official freebsd/freebsd-src repository. This is a static architecture and behavior review, not a build, exhaustive correctness audit, or verification of Rogue 5.4.4.

## Main finding: choose the implementation explicitly

The FreeBSD program identifies itself in `play.c` as Rogue Clone III by Tim Stoehr. It is a different implementation from the Rogue 5.4.4 discussed in `ideas.txt`. The proposed TypeScript architecture remains useful, but its claims about the original C structures do not describe this FreeBSD code.

Sources: [FreeBSD source directory](https://github.com/freebsd/freebsd-src/tree/releng/4.11/games/rogue), [play.c](https://github.com/freebsd/freebsd-src/blob/releng/4.11/games/rogue/play.c), [rogue.h](https://github.com/freebsd/freebsd-src/blob/releng/4.11/games/rogue/rogue.h).

| In ideas.txt | In the reviewed FreeBSD source | Port implication |
| --- | --- | --- |
| `THING` union | `struct obj`, with macros reusing fields for monsters | Split items and monsters into distinct types. |
| `PLACE` | `unsigned short dungeon[24][80]` | Separate terrain, features, and occupancy; preserve combinations. |
| `struct stats` | Player `fighter` plus monster fields | Preserve distinct player and monster combat formulas. |
| Room gold fields | Gold is already an object | Gold entities preserve this implementation's approach. |
| `passages[13]` | Room door links and tunnel cells | A corridor graph is a new abstraction, not a direct structure translation. |
| `command()` | `play_level()` dispatches commands | Extract input acquisition from action execution. |
| Daemons and fuses | `reg_move()` and explicit counters | A scheduler is a redesign; preserve timing first. |

## 1. Turn semantics are the first extraction priority

`play_level()` does not advance time after every command. Action implementations call `reg_move()` themselves. In `one_move_rogue()`, an impassable destination returns without advancing time, while attacking a monster advances time even though the function returns `MOVE_FAILED`. A failed attempt to escape a bear trap advances time; the being-held branch does not.

`reg_move()` checks hunger, moves monsters, updates the wandering-monster counter, updates status durations, heals, and runs automatic search, in that order. `mv_mons()` skips movement on odd player-haste counts; individual monsters have haste, slow, confusion, and flying behavior. Hunger fainting can run extra monster movement.

`search()` has a static alternating flag: ordinary completed search iterations call `reg_move()` on alternating iterations. Discovery and interruption can return before that point. Therefore neither action success nor action count is a sufficient clock.

Recommendation: return explicit action resolution with ordered events and an explicit time policy. Characterize the existing command paths before replacing them with a generic before/after scheduler. Keep action sequence numbers separate from simulation ticks.

Sources: [move.c](https://github.com/freebsd/freebsd-src/blob/releng/4.11/games/rogue/move.c), [monster.c](https://github.com/freebsd/freebsd-src/blob/releng/4.11/games/rogue/monster.c), [trap.c](https://github.com/freebsd/freebsd-src/blob/releng/4.11/games/rogue/trap.c).

## 2. Keep tiles authoritative; treat room/corridor graphs as indexes

The 24 by 80 allocation includes terminal-related bounds: movement allows rows 1 through 22. Nine room slots are arranged in three rows and columns, but generation also supports mazes, dead ends, crossing regions, hidden passages, and an occasional large room. A corridor is not necessarily a simple isolated connection between two ordinary rooms.

`can_move()` forbids diagonal movement into or out of doors. Its other diagonal check tests whether the two orthogonal neighboring cells are nonzero, rather than applying a generic modern corner-blocking rule. Hidden traps remain passable; other hidden cells are blocked.

Recommendation: preserve the generated tile topology and movement rules first. Derive render regions from it. Do not assume every region has four walls or every passage has exactly two room endpoints. A visible door is a passable tile here; an animated door opening must not silently add a new turn-consuming mechanic.

Sources: [level.c](https://github.com/freebsd/freebsd-src/blob/releng/4.11/games/rogue/level.c), [move.c](https://github.com/freebsd/freebsd-src/blob/releng/4.11/games/rogue/move.c).

## 3. Monster inventories would change this ruleset

The shared object structure does not provide the monster inventory described in the ideas. `cough_up()` generates a potential drop when a monster dies. `steal_item()` removes an item from the player's pack and makes the thief disappear; it does not transfer that item into a persistent monster pack.

Recommendation: use stable entity IDs and explicit ownership for floor objects and the player pack. Add persistent monster inventories only as an intentional extension. Keep loot generation at its original point if preserving random-call order.

Source: [spec_hit.c](https://github.com/freebsd/freebsd-src/blob/releng/4.11/games/rogue/spec_hit.c).

## 4. Combat needs more than a single dice expression

`get_damage()` accepts slash-separated dice groups. The proposed single `{count, sides, bonus}` cannot represent the full grammar. `get_w_damage()` adds hit enchantment to dice count and damage enchantment to dice sides. Ordinary monster damage is reduced according to player armor; monster hit chance is calculated separately. These are concrete rules, not interchangeable with a generic armor-class combat system.

Recommendation: parse damage into a list of dice groups and port the actual formulas, including C integer truncation. Do not infer behavior from modern field names such as `hitBonus`.

Source: [hit.c](https://github.com/freebsd/freebsd-src/blob/releng/4.11/games/rogue/hit.c).

## 5. Extract player knowledge before removing curses

`light_up_room()`, `light_passage()`, and `darken_room()` manage what remains drawn. The save code writes both dungeon masks and screen characters. Even `fight()` consults the displayed character when checking its target. Curses is therefore entangled with observation and command behavior, not merely output formatting.

Recommendation: introduce explicit current perception and remembered knowledge. Define visibility for blindness, invisible monsters, detection, disguises, hidden features, and maze exploration. Both first-person and tabletop views should consume that projection. Keep knowledge semantics when replacing terminal characters.

Sources: [room.c](https://github.com/freebsd/freebsd-src/blob/releng/4.11/games/rogue/room.c), [save.c](https://github.com/freebsd/freebsd-src/blob/releng/4.11/games/rogue/save.c), [hit.c](https://github.com/freebsd/freebsd-src/blob/releng/4.11/games/rogue/hit.c).

## 6. Persistence requires more state than globals alone

`main()` frees the current level's object and monster lists after `play_level()` returns, then generates another level. Ascending changes the depth before that generation; it does not restore a previous floor. Keeping an entire current level alive supports the design. Keeping all visited floors alive is a gameplay extension.

The original save system writes raw C structures and repairs some relationships on restore. It is unsuitable as a portable TypeScript format. Behavioral state also lives in function statics, including healing counters, alternating search state, and shuffled generator offsets.

The active FreeBSD RNG is selected through header macros: `rrandom` maps to system `random`, and `srrandom(x)` maps to `srandomdev()`. The bundled historical generator in `random.c` is disabled. `get_rand()` masks to 14 bits and uses inclusive modulo mapping. A modern seeded RNG provides reproducibility, but does not automatically reproduce historical sequences.

Hallucination code also consumes randomness while changing displayed characters. Render-frame randomness must not drive the gameplay RNG. Exact legacy parity would require preserving relevant random draws at the simulation cadence.

Recommendation: version the rules and saves; serialize behavioral counters, identification tables, knowledge, entity IDs, and RNG state. Explicitly decide which legacy quirks to preserve. Test uninterrupted play against save/load continuation.

Sources: [main.c](https://github.com/freebsd/freebsd-src/blob/releng/4.11/games/rogue/main.c), [save.c](https://github.com/freebsd/freebsd-src/blob/releng/4.11/games/rogue/save.c), [random.c](https://github.com/freebsd/freebsd-src/blob/releng/4.11/games/rogue/random.c), [use.c](https://github.com/freebsd/freebsd-src/blob/releng/4.11/games/rogue/use.c).

## Source notice

The reviewed files contain both Berkeley notices and an additional Stoehr notice restricting sale and use for personal gain or profit. This snapshot should not be described as unconditionally permissive merely because it came from FreeBSD. This review records the source text; it does not resolve the legal effect of those notices or permissions available elsewhere.

Source: [rogue.h notices](https://github.com/freebsd/freebsd-src/blob/releng/4.11/games/rogue/rogue.h).

## Recommended implementation sequence

1. Record the chosen source version and whether the goal is FreeBSD Clone III fidelity or Rogue 5.4.4 fidelity.
2. Extract state, seeded randomness, generation, and movement into a headless engine.
3. Add characterization cases for walls, diagonal doors, bump attacks, traps, search, haste, and status expiry.
4. Extract perception and remembered knowledge; build a simple grid viewer.
5. Add combat, inventory, identification, and versioned save/load with continuation checks.
6. Attach XR action input and local scene rendering to the tested engine.

The central architectural rule from ideas.txt remains sound: presentation proposes actions and renders observations; the engine owns outcomes and authoritative state.
