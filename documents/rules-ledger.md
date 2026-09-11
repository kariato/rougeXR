# Rules ledger

Reference: Davidslv/rogue at `f4653c2a2ee6981a73abe9dfda055134285e1e79`. Entries track design decisions and their implementation status.

| Area | Initial decision | Verification needed |
| --- | --- | --- |
| Turn cycle | Preserve `command.c` phases, free commands, and haste slots | Trace BEFORE, committed actions, AFTER, and ring effects |
| Search | Follow selected `command.c`; no Clone III alternating cost | Discovery outcomes, action consumption, searching rings |
| Monster inventory | Preserve carried objects and drops | Creation, death, ownership, and level cleanup |
| Combat | Port selected `fight.c` formulas | Hit/miss, dice groups, equipment modifiers, special attacks |
| Movement | Follow selected `move.c` rules | Diagonals, blocked movement, traps, bump attacks |
| Level lifecycle | Regenerate levels; keep carried items | Both travel directions and trap-driven transitions |
| Input | Replace terminal commands with keyboard/mouse actions; XR later | Selection cancellation, free UI operations, focus handling |
| Rendering | Replace curses with observation-driven 2D/3D views | Visibility, remembered information, disguises, detection |
| Persistence | New versioned JSON format; no C-save compatibility initially | State and replay continuity, including pending haste slots |
| Randomness | Specify xorshift32-v1, zero-seed mapping, and modulo range mapping in the implementation document | Fixed output vectors, saved continuation; C sequence parity is not claimed |
| Debug reveal | Read-only developer access, independent of player knowledge | No state mutation or hidden-data leakage into normal views |
| Scheduler overflow | Explicit transaction fault with rollback instead of invalid memory access | Full-slot allocation test |
| Initial content | Explicit slice mode enables only implemented mechanics; full mode requires handler coverage | Definition manifest and unsupported-action tests |
| Struct provenance | Full field-by-field mapping from `rogue.h` transcribed into `typescript-implementation.md` section 4; six initial gaps (`MonsterState.roomId`, `PLACE` `F_REAL`/`F_DROPPED`/`F_LOCKED`, per-instance ring identification, `o_text` sharing, `FLAME`, `S_ARMOR`/`S_ENCH`) verified against `move.c`, `passages.c`, `rooms.c`, `command.c`, `rings.c`, `scrolls.c`, `weapons.c`, `things.c`, `extern.c`, `fight.c`, `chase.c`, `monsters.c`, `init.c` | Verify sticks share rings' per-instance identification and worth-randomization behavior (`sticks.c` unread); `F_DROPPED`/`F_LOCKED` conclusion is absence-of-evidence, recheck if contradicted later |

Phase 3 implements the `command.c` cycle boundary as explicit `begin`, `input`, `after`, and `terminal` state. It implements live 20-slot daemon/fuse traversal corresponding to `daemon.c`, including clear-before-callback reuse and explicit overflow faults. Fixture handlers stand in for production effects until their owning phases; tests cover T01–T03 and T05–T07. T04 remains assigned to Phase 6 because it requires save/restore.

Phase 4 maps `io.c` `step_ok`, `chase.c` `diag_ok`, and the movement branch order in `move.c` `do_move`/`rndmove` into semantic terrain rules. `noMove` decrements before destination calculation and consumes a slot. Confusion uses the source's `rnd(5)`, then two `rnd(3)` draws, retaining them when the result is the current or an illegal cell. Room-to-door-to-passage transitions mirror the `enter_room`/`leave_room` boundary points without adding Phase 5 perception effects. `command.c`'s post-move pickup position is represented as a traceable deferred hook; ownership changes wait for Phase 8.

Add an entry before intentionally changing source behavior. Record the relevant source function, the difference, its reason, and its verification case.
