# rougeXR
A webxr version of rouge

Based on [Davidslv/rogue (Rogue 5.4.4)](https://github.com/Davidslv/rogue), initially pinned to `f4653c2a2ee6981a73abe9dfda055134285e1e79`.

Development starts in a regular desktop browser with keyboard and mouse controls, a 2D dungeon view, and a state inspector. Desktop 3D follows; XR is added after the game can be debugged without a headset.

Current implementation: Phase 9 now assembles reproducible generated worlds with Rogue's starting food, ring mail, mace, bow, and arrow stack; equipped armor and weapon; initialized knowledge; and production scheduler entries in source order. The generated world validates at its first input boundary, while the browser remains on the explicit fixture until Phase 9.7.

- [Browser-first design](documents/design.md)
- [Detailed TypeScript implementation specification](documents/typescript-implementation.md)
- [Phased implementation plan](documents/implementation-plan.md)
- [Quick 3D MMORPG presentation reference](documents/quick-3d-mmorpg-review.md)
- [Selected Rogue 5.4.4 source](documents/rogue544-base.md)
- [Rules ledger](documents/rules-ledger.md)
- [Historical FreeBSD Rogue comparison](documents/freebsd-rogue-review.md)
- [Original ideas](documents/ideas.txt)
