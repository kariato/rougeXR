# rougeXR
A webxr version of rouge

Based on [Davidslv/rogue (Rogue 5.4.4)](https://github.com/Davidslv/rogue), initially pinned to `f4653c2a2ee6981a73abe9dfda055134285e1e79`.

Development starts in a regular desktop browser with keyboard and mouse controls, a 2D dungeon view, and a state inspector. Desktop 3D follows; XR is added after the game can be debugged without a headset.

Current implementation: Phase 9 is playable in the regular browser. The default New Game path creates a deterministic generated dungeon from a user-supplied seed; explicit Kestrel and two-room fixtures remain available for focused debugging. The supported slice includes exploration, combat, basic inventory and survival rules, and downward level changes. Population still maps unsupported monsters and objects to the implemented subset until Phase 11.

Phase 10 browser debugging work has begun. Versioned saves now autosave to IndexedDB after completed actions and restore on startup; storage failures leave gameplay and manual JSON downloads available.

- [Browser-first design](documents/design.md)
- [Detailed TypeScript implementation specification](documents/typescript-implementation.md)
- [Phased implementation plan](documents/implementation-plan.md)
- [Quick 3D MMORPG presentation reference](documents/quick-3d-mmorpg-review.md)
- [Selected Rogue 5.4.4 source](documents/rogue544-base.md)
- [Rules ledger](documents/rules-ledger.md)
- [Historical FreeBSD Rogue comparison](documents/freebsd-rogue-review.md)
- [Original ideas](documents/ideas.txt)
