# rougeXR
A webxr version of rouge

Based on [Davidslv/rogue (Rogue 5.4.4)](https://github.com/Davidslv/rogue), initially pinned to `f4653c2a2ee6981a73abe9dfda055134285e1e79`.

Development starts in a regular desktop browser with keyboard and mouse controls, a 2D dungeon view, and a state inspector. Desktop 3D follows; XR is added after the game can be debugged without a headset.

Current implementation: Phase 4 provides a walkable two-room browser fixture on the deterministic command-cycle engine. Keyboard movement supports cardinal and diagonal directions, source-compatible blocking and confusion timing, room/passage transitions, and a deferred pickup trace; combat and item pickup remain explicitly unavailable.

- [Browser-first design](documents/design.md)
- [Detailed TypeScript implementation specification](documents/typescript-implementation.md)
- [Phased implementation plan](documents/implementation-plan.md)
- [Quick 3D MMORPG presentation reference](documents/quick-3d-mmorpg-review.md)
- [Selected Rogue 5.4.4 source](documents/rogue544-base.md)
- [Rules ledger](documents/rules-ledger.md)
- [Historical FreeBSD Rogue comparison](documents/freebsd-rogue-review.md)
- [Original ideas](documents/ideas.txt)
