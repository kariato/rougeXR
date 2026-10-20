# XR device acceptance checklist

Phase 13.6 requires a WebXR-capable headset and cannot be closed by desktop emulation. Record the browser, headset, controller model, date, and build commit for every run.

## Entry and teardown

- Enter XR from a running game and confirm the session begins at the same level, player cell, and revision.
- Exit with the application control and with the headset/browser system control.
- Re-enter twice. Confirm there are two controller rays, no duplicated gesture commits, and desktop input still works after exit.
- Remove the headset or interrupt tracking while holding a controller input. Confirm recovery does not commit an extra action.

## Comfort and tracking

- Stand still and move the head within the tracked area. Confirm physical tracking changes only the view and never the player cell or revision.
- Use squeeze once in each of eight directions. Confirm each gesture commits at most one grid move and blocked moves show rejected feedback.
- Aim and select an adjacent monster. Confirm one gesture commits one source-shaped directional action and its visual animation cannot initiate another attack.
- Switch to tabletop mode. Confirm the known dungeon is comfortably framed, unknown cells remain absent, and returning to first person preserves player state.

## Performance

- Record the median and worst observed frame rate in a populated room and in tabletop mode.
- Confirm there is no growing frame-time or memory trend after ten level/view transitions.
- Confirm controller rays and nearby actors remain stable during rapid head rotation.

## Result

Phase 13.6 passes only when every item above has been exercised on the target headset and any device-specific failures have been recorded or fixed.

## Spatial UI cleanup acceptance (19 October 2026)

These checks remain pending on physical hardware. Browser ray-selection tests cover navigation and actions but do not establish headset comfort or legibility.

- Read HP, depth, hunger, and equipment without leaning forward. Confirm the compact status panel stays clear of the main view.
- Open Inventory, Actions, and Menu using either controller ray. Confirm hovered buttons visibly highlight, passive headings do not activate, and menu interaction never moves the player.
- Open Settings, Controls, Discoveries, Effects, and Messages. Confirm Back and Close remain easy to target and the weapon does not obscure open panels.
- Resize the desktop mirror while wearing the headset. Confirm spatial controls retain their physical size and remain reachable.
- Select Throw or Zap. Confirm choosing a direction does not spend a turn, Cancel returns to inventory, and only confirmation submits the action.
- Confirm empty message panels are absent, messages expire after a few seconds, and history remains available from Menu → Messages.
- Confirm Pick up and stair actions appear only where relevant in Actions.
- Save, name, load, cancel a restart, and confirm a restart without using the browser toolbar.
- Exit VR through Settings and through the system interface, then re-enter and verify menu sizing and input.

## XR entry repair (20 October 2026)

The camera and controllers now share a tracking rig anchored at the current dungeon cell. XR uses a `local` reference space rather than requiring floor tracking. Browser resizes leave XR framebuffer sizing to the runtime, the native XR frame loop advances scene animations, and system exit restores the desktop renderer after Three.js completes its own cleanup. Failed attachment ends the session and reports the failure in the game.

Automated stereo tests use a simulated XR device and the real Three.js/WebGL renderer. They sample central dungeon pixels in both eyes, change tracked position, resize the mirror, exit/re-enter, recover from an attachment error, enter from Map, and select spatial menus through a tracked controller ray. This verifies the software rendering path; it does not replace testing the reported phone/browser or a physical headset.

## Grid movement comfort options (20 October 2026)

VR Settings → Movement & comfort now offers Comfort (default) and Glide. Comfort uses a brief fade with a fully covered frame at the position change; the nominal transition is 180 ms and may extend to preserve the covered frame during a rendering stall. Glide interpolates the horizontal rig position over 300 ms. Its optional peripheral vignette leaves the center visible. Preferences are stored per browser under `rougexr.locomotion.v1`.

The transition affects presentation only: one step still consumes one game turn, native head tracking remains immediate, and rig eye height stays steady. Combat does not force the tracked view to face a target. Long jumps and level transitions use Comfort rather than gliding across unseen terrain.

On the target headset, check both modes with the vignette enabled and disabled, repeated steps, diagonal movement, a blocked step, a level change, physical head motion during a step, and exit/re-entry. Confirm saved preferences survive a reload and identify the preferred mode through device testing; automated rendering checks cannot establish an individual's comfort.

## Touch controls, checkpoints, and seeds (20 October 2026)

On mobile, the primary button reads Forward when the cell ahead has no attackable monster, and Attack when one is directly ahead. A separate Search button sits above it. Confirm each tap commits one action, Search does not move, and both controls disappear while a spatial menu is open.

Save confirmation now stays inside the open Adventure menu, including an explicit failure message when browser storage is unavailable. Automatic checkpoint names use local date/time and the current world seed; manually entered names still update a matching checkpoint. Welcome and restart screens offer a world-seed field and Random button. In VR, Restart offers a controller-operated numeric keypad and Random seed button before confirmation. Confirm these controls are legible and reachable on the target phone and headset.
