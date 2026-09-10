# Quick 3D MMORPG: presentation reference

Reviewed 2026-09-10. Reference: [simondevyoutube/Quick_3D_MMORPG](https://github.com/simondevyoutube/Quick_3D_MMORPG), commit `547884332ca650abe96264f7230702d36481b9bc`. This was a static source review; the demo was not run. No code or assets from this repository have been incorporated into rougeXR.

## Decision

Use this project as a selective reference for Phase 12 desktop 3D presentation. Davidslv Rogue 5.4.4 remains the gameplay base. Retain the browser-first plan, plain TypeScript state, deterministic actions, and separate observation layer. Networking, outdoor terrain streaming, and the demo's entity framework are outside the current adoption scope.

## Patterns to adapt

| Reference | Adaptation | Boundary |
| --- | --- | --- |
| `third-person-camera.js` | Elapsed-time-based camera smoothing and offset/look-target separation | Camera transforms are presentation state; they never update the player grid position. |
| `player-state.js` | Idle/move/attack/death animation states, crossfades, and one-shot completion | Resolved engine events trigger animations. Animation callbacks cannot submit attacks or advance turns. |
| `load-controller.js` | Shared model loading and skeleton-aware cloning for animated instances | Independent animation mixers/skeletons; explicit ownership of shared geometry, materials, and textures. |
| `render-component.js` | Visual grouping and transform updates | Implement through our typed GameView/observation interfaces, without importing the demo's gameplay entity framework. |

Pinned sources: [camera](https://github.com/simondevyoutube/Quick_3D_MMORPG/blob/547884332ca650abe96264f7230702d36481b9bc/client/src/third-person-camera.js), [animation states](https://github.com/simondevyoutube/Quick_3D_MMORPG/blob/547884332ca650abe96264f7230702d36481b9bc/client/src/player-state.js), [loader](https://github.com/simondevyoutube/Quick_3D_MMORPG/blob/547884332ca650abe96264f7230702d36481b9bc/client/src/load-controller.js), [render component](https://github.com/simondevyoutube/Quick_3D_MMORPG/blob/547884332ca650abe96264f7230702d36481b9bc/client/src/render-component.js).

## Implementation differences required

The demo's entities store mutable Three.js vectors/quaternions and update components from the render loop. Its attack controller converts animation action changes into attack messages. rougeXR must keep the reverse relationship: a committed action resolves in the engine, then presentation animates its result. Use typed events and stable component identifiers rather than constructor-name lookups and arbitrary message topics.

Sources: [entity](https://github.com/simondevyoutube/Quick_3D_MMORPG/blob/547884332ca650abe96264f7230702d36481b9bc/client/src/entity.js), [application loop](https://github.com/simondevyoutube/Quick_3D_MMORPG/blob/547884332ca650abe96264f7230702d36481b9bc/client/src/main.js), [attack controller](https://github.com/simondevyoutube/Quick_3D_MMORPG/blob/547884332ca650abe96264f7230702d36481b9bc/client/src/attacker-controller.js).

Observed limitations to address when adapting the patterns:

- Input listeners have no matching component teardown. Focus changes can prevent key-up from clearing a previously set movement flag. Store removable callbacks, clear pressed state on blur/visibility loss, and always handle releases for captured keys.
- Mouse selection takes the first intersecting entity in iteration order. Use distance-sorted ray hits, limited to currently observable/selectable objects, with an explicit occlusion policy.
- Loader caches use filenames without paths. Key by resolved asset URL and load options; represent failed loads explicitly so waiting consumers do not remain pending forever.
- Render cleanup assumes a single material although loading supports material arrays. Handle arrays, texture ownership, and shared-resource reference counts.
- Async loading has no destroyed-view guard. Give each view a lifecycle token; late results may populate a shared cache but must not attach to a stale scene.
- The loader disables frustum culling for skinned models. Do not copy that globally; verify bounds and profile visible animated instances on target hardware.

Input source: [player-input.js](https://github.com/simondevyoutube/Quick_3D_MMORPG/blob/547884332ca650abe96264f7230702d36481b9bc/client/src/player-input.js). Loader and cleanup findings refer to the pinned files linked above.

## Phase 12 checks

1. Compare camera smoothing over equivalent elapsed time at different frame rates; engine state is unchanged.
2. Replay the same actions with animations enabled, skipped, and accelerated; engine hashes match.
3. Select overlapping visible objects; select the nearest eligible hit rather than the first inserted entity, respecting occlusion.
4. Load two assets with identical filenames from different paths; they remain distinct.
5. Destroy a view during loading; no late scene attachment or retained listeners occurs.
6. Destroy one of two model instances; the surviving instance's resources remain valid.
7. Blur or switch views while an input is held; input does not remain stuck or duplicate on remount.

The repository includes an MIT license and separate resource notices. Preserve applicable notices for any future code reuse, and inspect the particular asset's supplied notice before importing it. This review does not establish one blanket license for all bundled assets. Select modern pinned dependencies during implementation rather than copying the demo's CDN imports unchanged.

See [the implementation specification](typescript-implementation.md) and [Phase 12 plan](implementation-plan.md) for the controlling interfaces and milestones.
