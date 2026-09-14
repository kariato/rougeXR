# Rogue command audit

Reference: Davidslv/rogue `command.c` at `f4653c2a2ee6981a73abe9dfda055134285e1e79`.

The browser exposes state-changing play as typed engine actions. Terminal drawing, pagination, and process-control commands become persistent panels or browser controls. The table covers every non-wizard branch in `command()` plus the directional movement branches immediately above it.

| Source command | Browser disposition | Turn behavior |
| --- | --- | --- |
| `hjklyubn`, cursor directions | `move` action; arrows, WASD, HJKL, and diagonals | Committed legal move or source-shaped rejection |
| shifted/control direction run | Repeated discrete movement input; continuous key repeat is deliberately suppressed | Each accepted cell remains one replay action |
| `f` fight-to-death | Bump combat plus repeated movement actions | Each attack is independently committed and inspectable |
| `m` move without pickup | Engine `move` with `pickup:false`; reserved for future alternate desktop binding and XR locomotion | Same movement cost |
| `t` throw | Inventory Throw button with eight-direction selector | Committed |
| `a` repeat | Repeat the visible browser control or replay action | No hidden last-command state |
| `q` quaff | Inventory Drink button | Committed, except source haste handling already represented by the scheduler |
| `Q` quit | New Game or close the browser tab | Browser lifecycle, outside canonical state |
| `i`, `I` inventory | Persistent Inventory panel | Free observation |
| `d` drop | Inventory Drop button | Committed |
| `r` read | Inventory Read button | Committed; serialized follow-up decisions |
| `e` eat | Inventory Eat button | Committed |
| `w`, `W`, `T` weapon/armor | Equip and Remove buttons | Committed |
| `P`, `R` rings | Wear left, Wear right, and Remove buttons | Committed |
| `o` options | Browser controls and saved debug preferences | Outside canonical game rules |
| `c` call | Inventory Call button and automatic post-use call decision | Free action; labels serialize and replay |
| `>`, `<` stairs | Descend and Ascend buttons; matching keys | Valid transitions commit; invalid attempts are free |
| `?` help | Always-visible control legend and accessible labels | Free observation |
| `/` identify glyph | Selected-cell inspector and inventory labels | Free observation; respects player knowledge |
| `s` search | Search button and `F` browser shortcut | Committed |
| `z` zap | Inventory Zap button with eight-direction selector | Committed |
| `D` discoveries | Known/called identities are visible through inventory; a dedicated catalog is deferred to presentation work | Free observation |
| `Ctrl-P` previous message | Persistent Events panel | Free observation |
| `Ctrl-R` redraw | Canvas redraws automatically | Presentation only |
| `v` version | Build metadata/documentation | Presentation only |
| `S` save | Save JSON and automatic IndexedDB checkpoint | Free browser operation |
| `.` rest | Rest button, period, or space | Committed rest |
| space no-op | Space intentionally maps to Rest for browser accessibility | Committed browser difference |
| `^` name trap | Selected-cell inspector reports revealed trap features | Free observation; hidden traps remain hidden |
| Escape | Cancel or leave the current browser interaction | Presentation only |
| `)`, `]`, `=`, `@` current/status | Persistent equipment and status panels | Free observation |

Wizard-only commands are excluded from gameplay. The read-only debug reveal replaces their inspection purpose and is visibly marked, never included in ordinary observations, saves, or replay results.
