# rougeXR
A webxr version of rouge

Based on [Davidslv/rogue (Rogue 5.4.4)](https://github.com/Davidslv/rogue), initially pinned to `f4653c2a2ee6981a73abe9dfda055134285e1e79`.

Development starts in a regular desktop browser with keyboard and mouse controls, a 2D dungeon view, and a state inspector. Desktop 3D follows; XR is added after the game can be debugged without a headset.

Current implementation: the Phase 11 full-rules candidate and Phase 12 desktop 3D presentation are playable in the regular browser. First-person 3D is the default, with orbit and tabletop cameras; the original map remains available from the view selector without restarting the session. The default New Game path creates a deterministic generated dungeon from a user-supplied seed; explicit Kestrel and two-room fixtures remain available for focused debugging. Generation includes the complete source monster and object tables, treasure rooms, wandering monsters, the Amulet, ascent, and victory. Browser replacements for terminal commands are recorded in the command audit.

Phase 13 now includes optional immersive-VR session entry, tracked controller rays, debounced revision-checked directional gestures, and tabletop scaling. Unsupported browsers retain the complete desktop game. Target-headset comfort, tracking-loss, and performance verification remains the final hardware gate.

Phase 10 browser debugging is complete. Versioned saves autosave to IndexedDB after completed actions and restore on startup; storage failures leave gameplay and manual JSON downloads available. Imported replay bundles can be restarted, stepped one action at a time, played, paused, and viewed at selectable speeds while live game input is locked. Replay history is capped at 1,000 actions and advances its verified checkpoint as older entries rotate out. Browser diagnostics include event-category filters, action timing, and first-divergence action and hash details.

Run `npx playwright install chromium firefox` once, then `npm run test:browser` for the Chromium and Firefox smoke matrix.

- [Browser-first design](documents/design.md)
- [Detailed TypeScript implementation specification](documents/typescript-implementation.md)
- [Phased implementation plan](documents/implementation-plan.md)
- [Quick 3D MMORPG presentation reference](documents/quick-3d-mmorpg-review.md)
- [Selected Rogue 5.4.4 source](documents/rogue544-base.md)
- [Rules ledger](documents/rules-ledger.md)
- [Historical FreeBSD Rogue comparison](documents/freebsd-rogue-review.md)
- [Original ideas](documents/ideas.txt)
