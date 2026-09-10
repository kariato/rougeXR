# Selected source: Davidslv Rogue 5.4.4

Selected by the user on 2026-09-10. Repository: https://github.com/Davidslv/rogue

Initial pinned revision: `f4653c2a2ee6981a73abe9dfda055134285e1e79`.

This repository is the behavioral base for the browser-first TypeScript port. The prior FreeBSD Clone III review remains useful background, but its implementation-specific conclusions are not requirements. The selected source was downloaded into a temporary checkout for inspection; it has not been vendored into this project or compiled as part of this design update.

## Verified source mappings

All links below refer to the pinned revision.

- [rogue.h](https://github.com/Davidslv/rogue/blob/f4653c2a2ee6981a73abe9dfda055134285e1e79/rogue.h): source domain structures; translate `THING` into distinct actor/item types and `PLACE` into explicit logical tiles.
- [command.c](https://github.com/Davidslv/rogue/blob/f4653c2a2ee6981a73abe9dfda055134285e1e79/command.c): BEFORE scheduling, one or two player action slots depending on haste, free-command handling through `after`, AFTER scheduling, and ring effects. Search is implemented here; Clone III search alternation does not apply.
- [daemon.c](https://github.com/Davidslv/rogue/blob/f4653c2a2ee6981a73abe9dfda055134285e1e79/daemon.c): delayed-action slots for recurring daemons and timed fuses. Preserve execution phase and ordering in serializable data.
- [monsters.c](https://github.com/Davidslv/rogue/blob/f4653c2a2ee6981a73abe9dfda055134285e1e79/monsters.c): monster creation initializes `t_pack`; `give_pack()` can add carried objects.
- [fight.c](https://github.com/Davidslv/rogue/blob/f4653c2a2ee6981a73abe9dfda055134285e1e79/fight.c): combat resolution and release of carried objects. Use these formulas rather than those from FreeBSD Clone III.
- [new_level.c](https://github.com/Davidslv/rogue/blob/f4653c2a2ee6981a73abe9dfda055134285e1e79/new_level.c): clears old monster packs, monsters, and level objects before building the next level. Persistent prior floors remain an intentional extension outside the initial scope.
- [LICENSE.TXT](https://github.com/Davidslv/rogue/blob/f4653c2a2ee6981a73abe9dfda055134285e1e79/LICENSE.TXT): redistribution conditions and notices for the game and listed contributed portions. Preserve applicable notices with reused or derived code and distributions. The additional Stoehr notice discussed in the FreeBSD review is not the notice in this file.

## Port policy

Keep the browser-first development sequence: headless engine, desktop 2D debugging, desktop 3D, then XR. Source selection changes the reference rules, not that workflow.

Treat this pinned repository as the reference, including its maintenance changes; do not claim automatic identity with every historical 5.4.4 distribution. Each implemented mechanic needs source-specific characterization cases. These notes verify the architectural mappings above, not every rule or historical behavior.

The TypeScript representation may replace pointers, globals, curses calls, and platform-specific saves. Preserve observable rules unless a difference is recorded in the ledger. A new seeded RNG establishes deterministic port behavior; exact C random-sequence parity requires separate verification.

Keep pending command-cycle state in saves so browser input can suspend between commands without changing daemon/fuse frequency. This is especially important for free commands and saves between hasted actions.
