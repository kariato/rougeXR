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
| Randomness | Explicit seeded algorithm and saved state | Reproducibility; C sequence parity is not yet claimed |
| Debug reveal | Read-only developer access, independent of player knowledge | No state mutation or hidden-data leakage into normal views |

Add an entry before intentionally changing source behavior. Record the relevant source function, the difference, its reason, and its verification case.
