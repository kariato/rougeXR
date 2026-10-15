# rougeXR
A webxr version of rouge

Based on [Davidslv/rogue (Rogue 5.4.4)](https://github.com/Davidslv/rogue), initially pinned to `f4653c2a2ee6981a73abe9dfda055134285e1e79`.

Development starts in a regular desktop browser with keyboard and mouse controls, a 2D dungeon view, and a state inspector. Desktop 3D follows; XR is added after the game can be debugged without a headset.

Current implementation: the Phase 11 full-rules candidate and Phase 12 desktop 3D presentation are playable in the regular browser. First-person 3D is the default, with orbit and tabletop cameras; the original map remains available from the view selector without restarting the session. The default New Game path creates a deterministic generated dungeon from a user-supplied seed; explicit Kestrel and two-room fixtures remain available for focused debugging. Generation includes the complete source monster and object tables, treasure rooms, wandering monsters, the Amulet, ascent, and victory. Browser replacements for terminal commands are recorded in the command audit.

In first person, press `[` to turn the POV left or `]` to turn right. First-person turning snaps in 90° steps to face doors and corridors squarely. Keyboard, touch, mouse drags, and on-screen turn buttons use the same cardinal headings. Camera turning does not advance Rogue time. Arrow keys and WASD still move in dungeon directions.

Enter a Save name and press Save Game in the top toolbar to store a named JSON checkpoint in this browser’s local storage. Choose a name in Saved games and press Load Save to restore it. Different names keep separate checkpoints; saving the same name updates that checkpoint. Load Save restores that exact point, even after later turns, a new game, or reloading the page. This checkpoint is separate from automatic saves; Save JSON / Load JSON in Tools still support file export and import.

Synthesized sound effects accompany footsteps, combat, pickups, doors, stairs, magic, death, and victory. Audio starts after a click or keypress. The toolbar Sound button mutes audio; Tools contains a volume slider. Both preferences persist in this browser.

The in-world Menu button (or `M` on desktop) provides Search, Rest, Pick up, inventory, named saves with a ray-selectable keyboard, loading, map/POV switching, sound/volume, stairs, and confirmed restart. The menu remains accessible after death for loading or restarting. All controls accept desktop pointer clicks or VR controller trigger rays.

Revealed traps have distinct labeled 3D models for trapdoors, bear traps, sleeping gas, arrows, teleportation, poison darts, rust spray, and mystery traps. Successful searches visibly expose secret doors/passages and mark discoveries with a short turquoise outline, rising sparks, and a chime; undiscovered traps remain hidden.

An in-world status panel shows health, depth, gold, hunger, weapon, and active effects. Colored status badges cover poison-related strength loss, confusion, blindness, holding/traps, hunger, and known cursed equipment. Select the badges or Menu → Effects for explanations and recovery advice. Curses stay hidden until the item is identified or removal is attempted; discovered curses and poison weakness survive saving/loading. A second panel retains recent gameplay messages in the headset.

The 3D Inventory button (or `I` on desktop) opens a spatial inventory panel with item models, selection, equipment and consumable actions, paging, and throw/zap directions. Desktop clicks and VR controller trigger rays use the same controls; movement is blocked while the panel is open. On death the view becomes black and white and a large in-scene DEAD panel appears.

Disclosed stairs appear as a stone spiral stairwell with a brass handrail in 3D. Stepping onto stairs automatically descends one dungeon level before finding the Amulet, and ascends while carrying it (unless levitating). Ascending from level 1 with the Amulet wins; the Descend button and `>` remain available when already standing on stairs. Ascend / `<` and Descend / `>` also remain available when already standing on stairs.

On touch screens, drag the circular movement stick at the lower left. In first person, up and down move forward and backward while left and right turn the POV in 90° steps. The stick snaps diagonal drags to the stronger axis, so only one action occurs at a time. In map, orbit, and tabletop views it moves in four dungeon directions. Release it to stop repeating input. The Attack button at the lower right enables when a disclosed monster is directly in front of the player.

Phase 13 now includes optional immersive-VR session entry, tracked controller rays, debounced revision-checked directional gestures, and tabletop scaling. Unsupported browsers retain the complete desktop game. Target-headset comfort, tracking-loss, and performance verification remains the final hardware gate.

Phase 14 first-person presentation has begun: every generated room stores a deterministic visual theme and non-blocking decoration plan at creation time. All eight current decoration kinds, all nine collectible item categories, all nine wieldable weapon types, and all 26 Rogue monsters now have original Blender GLBs loaded from disclosed observations with primitive fallbacks. The equipped weapon appears in the first-person hand and follows the resolved attack/action motion. The historical `crate` prop is now a decorative treasure chest, and ordinary rooms place inward-facing wall torches at creation time; at most four currently visible torches provide local presentation light. The browser opens with a dominant first-person viewport, compact observation-backed HUD, and collapsible tools panel. Room surfaces vary deterministically with dungeon stone, cave rock, crypt masonry, store wood, and treasure inlay patterns and theme-aware lighting. Remaining visual work consolidates creature assets and combat clips, builds structural room silhouettes and authored environment kits, and adds event-driven combat feedback. Only disclosed cells and entities reach the renderer.

Phase 10 browser debugging is complete. Versioned saves autosave to IndexedDB after completed actions and can be selected as Latest autosave on the welcome screen; storage failures leave gameplay and manual JSON downloads available. Imported replay bundles can be restarted, stepped one action at a time, played, paused, and viewed at selectable speeds while live game input is locked. Replay history is capped at 1,000 actions and advances its verified checkpoint as older entries rotate out. Browser diagnostics include event-category filters, action timing, and first-divergence action and hash details.

Run `npx playwright install chromium firefox` once, then `npm run test:browser` for the Chromium and Firefox smoke matrix.

## GitHub Pages

The Pages workflow builds and deploys `main` to `https://kariato.github.io/rougeXR/`.
In the repository's **Settings → Pages**, set **Build and deployment → Source** to
**GitHub Actions**. Then run **Deploy GitHub Pages** from the Actions tab or push
to `main`. The workflow uses Node 24 and builds with the `/rougeXR/` base path.
To check that build locally, run `GITHUB_PAGES=true npm run build` and
`GITHUB_PAGES=true npx vite preview`.

- [Browser-first design](documents/design.md)
- [Detailed TypeScript implementation specification](documents/typescript-implementation.md)
- [Phased implementation plan](documents/implementation-plan.md)
- [Quick 3D MMORPG presentation reference](documents/quick-3d-mmorpg-review.md)
- [Selected Rogue 5.4.4 source](documents/rogue544-base.md)
- [Rules ledger](documents/rules-ledger.md)
- [Historical FreeBSD Rogue comparison](documents/freebsd-rogue-review.md)
- [Original ideas](documents/ideas.txt)

### Endings and discoveries

Death and escape now open an in-world results panel, also available on the map. Death records its cause in saved games; both endings show the deepest level reached, gold, experience, turns, and a score (gold + experience, with a 1,000-point escape bonus). Restart starts a fresh adventure; Load Save offers the browser’s named checkpoints. Older death saves without a recorded cause display “An unknown dungeon danger.”

Equipment uses readable names such as “Mace” and “Ring mail,” including older saves with internal IDs as labels. Custom item names remain intact. Menu → Discoveries (or Tools → Discoveries) lists identified potions, scrolls, rings, and wands/staves with their randomized appearances. The list retains knowledge after items are used or dropped and never reveals unlearned identities.

On launch, a welcome screen offers **Start New Game** or **Load Saved Game**. The save selector includes named browser checkpoints, a legacy checkpoint if present, and the latest automatic save. Nothing restores until you choose it. Missing, unavailable, or incompatible saves leave the new-game option available.

Solid room props (chests, rubble, columns, urns, and mushrooms) block movement, including diagonal shortcuts around their corners. Open chests remain solid. Walking beside a reachable chest opens it and collects its gold in the same movement turn. Bones and scattered coins remain walkable. Solid props also appear on the map. New levels keep props clear of creatures, loot, traps, stairs, and player spawns, and omit props that would split an existing route.
