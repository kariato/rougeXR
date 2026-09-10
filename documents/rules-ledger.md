# Rules ledger

Reference: Davidslv/rogue at `f4653c2a2ee6981a73abe9dfda055134285e1e79`. Entries below are design decisions, not completed implementation or passing tests.

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
| Struct provenance | Full field-by-field mapping from `rogue.h` transcribed into `typescript-implementation.md` section 4 | Resolve open items: `roomId` missing from `MonsterState`, `PLACE` `F_REAL`/`F_DROPPED`/`F_LOCKED` semantics, per-instance vs per-type ring identification, `o_text` sharing, the `FLAME` weapon constant, and `S_ARMOR` vs `S_ENCH` scroll semantics — each against its own source file before the touching module is implemented |

Add an entry before intentionally changing source behavior. Record the relevant source function, the difference, its reason, and its verification case.
