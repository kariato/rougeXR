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
