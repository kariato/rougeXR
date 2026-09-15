# Phase 14.2 — viewport-first browser shell and HUD

## Outcome and scope

The first-person scene is the default, dominant browser surface. A compact status bar, readable event message, and primary actions support ordinary play; setup, replay, inspection, and reveal remain reachable in a collapsible tools panel. Map, orbit, and tabletop remain available without creating a new `GameSession`. This slice changes browser presentation and input layout only. Materials, room meshes, combat particles, and monster animation transitions belong to later Phase 14 steps.

## Existing seams

- `index.html` currently places every command in one wrapping header, gives `.layout` a permanent 19rem inspector column, and gives `.map` 1rem padding and a 26rem minimum height. These constraints shrink the first-person scene and create page scrolling on narrow screens.
- `src/app/main.ts` binds controls by ID and owns `render()`. Preserve existing IDs and listeners while moving controls; no engine action should be submitted by a HUD update or panel toggle.
- `PlayerObservation.status` already supplies HP, maximum HP, gold, depth, and hunger stage. `PlayerObservation.inventory` supplies equipped item labels. The HUD and prompts must read this observation and resolved `PresentationEvent`s. `stateSummary`, `inspector`, and reveal-only debug data remain inside tools.
- `#view-host` is the existing mount for `ThreeGameView`; `#dungeon` is the alternate map canvas. Keep both in place and allow the views to use the same available rectangle.

## DOM and layout implementation

1. Replace the current crowded header with a compact shell toolbar: title, current view selector, camera selector, New Game, tools toggle, and XR control. Move world type and seed into a Setup section in the tools panel; move save/load/export, replay, inspector, raw event controls, and authoritative reveal into their own labeled sections. Put existing action buttons in a compact action strip associated with the viewport; keep their IDs. Inventory stays in a reachable panel because item use is gameplay, not debugging.
2. Make `.layout` one flexible viewport column while tools are closed. When tools open on a desktop-width screen, use a bounded overlay or drawer so the scene is still large; at narrow widths use a full-width panel that can scroll internally. A closed panel must not occupy layout width or tab order. Use semantic `button` plus `aria-expanded`/`aria-controls` for the tools toggle; restore focus to the toggle when closing with Escape. Do not steal Escape when an item decision or XR mode already consumes it.
3. Set the shell to `min-height: 100dvh` and the view region to `minmax(0, 1fr)`. Remove fixed canvas minimum heights and large padding. At 1366×768, the visible `#view-host` rectangle should cover at least 70% of viewport area (`width × height`, divided by `1366 × 768`) with the tools panel closed and ordinary play should have no document-level vertical scroll. The Three.js view still owns its resize handling.
4. Keep a single clear primary path at 390×844: toolbar, viewport, then touch-sized actions. Use safe-area insets where applicable. Buttons need at least 44×44 CSS px hit areas. The tools panel may scroll, but the gameplay viewport and actions must be usable without horizontal scrolling. Map, orbit, and tabletop selection must preserve the live session and replay hash.

## HUD data and behavior

- Render HP/max HP, depth, gold, hunger, and equipped weapon into a compact, high-contrast status strip. Use `observation.status` and equipped `observation.inventory` rows; show a neutral empty-weapon label when none is equipped. Never read `debugFixtureSnapshot` or `state.player` for player-facing HUD fields.
- Show the newest resolved `message` or `sourceMessage` event in an `aria-live="polite"` message region. Retain the existing event list in tools. Do not announce repetitive movement events as messages, and do not clear an important message merely because `render()` runs again without a new event.
- Add a visual center crosshair to first-person mode only; hide it in map, orbit, and tabletop modes. Set `aria-hidden="true"` on decorative crosshair markup.
- Reserve a context-prompt element, but populate it only from currently disclosed observation cells/entities and existing resolved interaction information. Its first implementation can be limited to disclosed adjacent stairs or an item in the player's current cell. A richer door/actor prompt is part of 14.7 if a safe targeting contract is needed. Do not infer undiscovered neighbors from room design metadata.
- Update HUD DOM text only after `observe(state)` in the existing `render()` path. Panel open/close and display-mode changes must not call `submit()`, alter engine time, or modify saved/replay data.

## Focus, motion, and failure cases

- Preserve movement shortcuts when gameplay has focus; typing in seed, selects, file controls, and inventory decisions must not trigger movement. Verify the existing desktop input guard against the new panel structure.
- Give all interactive controls visible focus outlines, labels, and logical tab order. When the panel closes, its descendants are inert/hidden. Preserve access to reveal controls without accidentally turning reveal on.
- Apply `prefers-reduced-motion` to drawer transitions and message movement; do not animate the canvas container on resize. Use opaque or strongly shaded HUD backgrounds so light treasure rooms and dark caves are both legible.
- Keep primitive and failed-model fallbacks in the scene. A renderer load failure should leave the toolbar, HUD, map selector, and tools usable.

## Small implementation steps

| Slice | Change | Evidence before continuing |
| --- | --- | --- |
| 14.2a | Rebuild `index.html` shell, move existing controls by ID, and add the tools toggle without changing handlers. | Existing New Game, movement, save/load, replay, reveal, view switch, and XR availability controls still work. |
| 14.2b | Add observation-backed HUD fields and latest-event message to `main.ts`. | Fixed-seed HUD values match the observed status; a hidden/debug field cannot appear in ordinary HUD. |
| 14.2c | Add crosshair and the limited disclosed-cell prompt, with mode-specific visibility. | First-person shows them; map/orbit/tabletop hide the crosshair; unknown cells produce no prompt. |
| 14.2d | Finish desktop/mobile CSS, focus behavior, reduced motion, and panel scrolling. | At 1366×768 the viewport covers ≥70% of the window and ordinary play has no page scroll; at 390×844 there is no horizontal scroll and actions are reachable. |
| 14.2e | Run browser and replay checks once the grouped UI change is ready. | Chromium and Firefox keyboard/touch smoke checks pass, and the same fixed-seed actions have identical engine/replay hashes before and after the shell change. |

## Completion gate

Phase 14.2 is complete when the measured desktop viewport target, narrow-screen playability, controls/focus checks, and observation privacy checks pass. Capture first-person screenshots at 1366×768 and 390×844 with tools closed, plus one screenshot with tools open, for the Phase 14 visual baseline. Keep 14.2 open if the game is merely restyled but still presents the debug inspector as the primary screen.
