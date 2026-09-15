# Monster asset pipeline

This document describes the pipeline used for the procedural Blender monster studies in RougeXR. It covers the current workflow, the conventions a new asset must follow, validation, and the parts that should be automated before the models are connected to gameplay.

## Purpose and current scope

Each monster is authored as a Python generator rather than modeled manually. Running the generator from the repository root creates three committed artifacts:

| Artifact | Location | Purpose |
| --- | --- | --- |
| Generator | `tools/blender/create_<monster>.py` | Reproducible source of the mesh, materials, rig, animation, export, and preview setup |
| Blender source | `art/blender/creatures/<monster>.blend` | Editable inspection file with the rig and animation tracks |
| Runtime model | `public/assets/creatures/<monster>.glb` | Self-contained model loaded by Three.js in the browser |
| Preview image | `art/previews/<monster>.png` | Quick visual review of the rest pose and silhouette |

The completed studies are bat, centaur, hobgoblin, ice monster, kestrel, leprechaun, orc, quagga, rattlesnake, snake, and zombie. They are available in the standalone browser model viewer. The gameplay renderer does not yet select these GLBs for monster entities.

## Toolchain

- Blender 4.5 LTS is the reference authoring and export version.
- Blender's bundled Python and `bpy` API generate every asset without third-party Blender add-ons, source models, or texture files.
- The Blender glTF exporter writes a binary GLB with skins and separate NLA animation clips.
- Three.js loads the GLB in `src/model-preview.ts`.
- Vite serves `model-preview.html` during local review and browser tests.
- Playwright checks loading and clip selection in Chromium and Firefox.

Run a generator from the repository root:

```powershell
blender --background --python tools/blender/create_bat.py
```

If Blender is not on `PATH`, invoke the Blender executable by its full path and keep the working directory at the repository root. A successful run prints the three generated artifact paths.

## Generator stages

The existing scripts follow the same sequence.

1. Resolve all output paths relative to the generator file, create their parent directories, clear Blender's default scene, use metric units, and set animation to 24 frames per second. `save_version = 0` prevents unwanted `.blend1` backups.
2. Define simple Principled BSDF materials. Colors are embedded in the GLB, so the current models need no external texture files.
3. Build low-poly geometry from primitives or explicit vertices. Parts are named for inspection and assigned to vertex groups as they are created.
4. Join the parts into one skinned mesh. The mesh origin is placed at world zero. Custom faces must have outward-facing normals; thin surfaces such as wings should be closed solids rather than single-sided cards.
5. Create an armature at world zero. Bone names are descriptive and stable within the model. Add an Armature modifier and parent the mesh to the rig.
6. Define pose functions and bake one action per required clip. Every keyed frame first resets all pose channels, applies the procedural pose, and then inserts keys. This prevents one animation from inheriting state from another.
7. Put each action in a separate NLA track named after its runtime clip. The tracks are muted before saving the `.blend`, leaving an uncluttered rest-pose editing view.
8. Save the editable Blender source.
9. Temporarily unmute every NLA track, select only the mesh and rig, and export a self-contained binary glTF using `export_animation_mode='NLA_TRACKS'` and `export_skins=True`.
10. Restore the rest pose, add an orthographic camera, and render a 1000 by 800 PNG with Blender Workbench material colors, shadows, and cavity shading.

The generator is the reproducible source of truth. If the `.blend` is edited by hand, reproduce that change in the generator before committing regenerated outputs.

## Coordinate and scale conventions

- Use meters. Model dimensions should make sense beside a roughly human-scale first-person player.
- Place the rig and mesh origins at `(0, 0, 0)`.
- Author the creature facing Blender `-Y`; the exported glTF faces `+Z` in the viewer.
- Ground creatures should rest at `Z = 0`. Flying creatures should use an intentional hover height documented in `art/README.md`.
- Keep locomotion in place. Small root translations may sell a lunge, hop, or recoil, but navigation remains the game's responsibility.
- Keep all deformed vertices within a sensible distance of the origin throughout every clip. This catches broken weights and transforms before browser integration.

## Required animation contract

Every monster currently exports exactly five clips, in this order:

| Clip | Looping | Intended use |
| --- | --- | --- |
| `idle` | Yes | Breathing, looking, hovering, or another quiet readable motion |
| `move` | Yes | Walk, slither, flap, or other in-place locomotion |
| `attack` | No; hold final frame | The creature's primary attack with a clear anticipation and contact pose |
| `hurt` | No; hold final frame | Short directional recoil or flinch |
| `death` | No; hold final frame | Collapse or fall toward the ground plane |

Idle and move must return cleanly to their first pose. One-shot clips should begin near the rest pose so a future crossfade does not pop severely. Current generators use either Euler or quaternion keys according to the rig; a single action must use one rotation representation consistently.

## Adding a monster

1. Copy the nearest anatomical generator as a starting point: hobgoblin for bipeds, kestrel or bat for flying creatures, and rattlesnake for flexible chains.
2. Replace all asset names, paths, materials, geometry, bone layout, poses, camera framing, dimensions, and documentation. Avoid leaving source-species mesh or data-block names in the output.
3. Run the generator and inspect `art/previews/<monster>.png` for silhouette, scale, ground contact, clipping, and readable identifying features.
4. Open the `.blend` when joint orientation, weights, or a specific keyed pose needs closer inspection. Enable only one NLA track at a time while editing.
5. Register the model in all three current viewer locations:
   - add an option to `model-preview.html`;
   - add its identifier and any camera override to `src/model-preview.ts`;
   - add it to the model array in `tests-e2e/model-preview.spec.ts`.
6. Add an entry to `art/README.md` containing the generator, source, GLB, preview, rig, clips, scale, facing, regeneration command, and integration status.
7. Complete the validation checklist below and commit the generator together with all regenerated artifacts and viewer changes.

Open the viewer after starting Vite:

```powershell
npm run dev
```

Then visit `http://127.0.0.1:5173/model-preview.html?model=<monster>`.

## Validation checklist

### Export structure

- The GLB parses without external resources.
- It contains at least one skinned mesh and the expected bone count.
- Its clip names and order are exactly `idle`, `move`, `attack`, `hurt`, `death`.
- Sampling each clip changes at least one bone transform.
- Sampled skinned vertex positions remain finite and inside a reasonable model bound.

### Visual review

- The rest-pose preview has a recognizable silhouette at thumbnail size.
- Front, side, and rear orbit views have no open seams, inverted faces, disconnected membranes, severe weight stretching, or body parts below the ground.
- Idle and move loop without a visible jump.
- Attack communicates its contact point; hurt reads differently from attack; death ends near the ground.
- The camera frames the entire model throughout every animation.

### Repository checks

Run these after regenerating and registering the asset:

```powershell
npm run typecheck
npm run test:browser -- --grep "loads the Blender" --workers=1
git diff --check
```

The browser suite is deliberately run with one worker. Rendering several WebGL scenes concurrently has caused timeouts on this development machine even when each model is valid. The sequential suite currently produces two checks per model: one in Chromium and one in Firefox.

## Review of the current implementation

The current approach is effective for early production. It creates compact, self-contained runtime files, retains editable sources, gives every creature a common animation vocabulary, and makes browser inspection possible before gameplay integration. The generators also provide strong provenance: the assets are original and reproducible without downloaded models or textures.

Several limitations should be addressed as the library grows:

1. **Model registration is duplicated.** The HTML selector, TypeScript allowlist, camera rules, and Playwright model list can drift. Replace them with one typed monster-asset manifest that drives the viewer and tests.
2. **Generator infrastructure is duplicated.** Material helpers, primitive builders, rig setup, action baking, GLB export, and preview rendering are repeated in every script. Move stable behavior into a shared Blender Python module while leaving species geometry and poses in individual files.
3. **Structural GLB validation is manual.** The browser test confirms loading and selection, but it does not prove that clips move bones or that skin deformation stays finite. Check in a Node validation script and run it for every manifest entry.
4. **Generated-file freshness is unchecked.** Continuous integration should regenerate each model with the pinned Blender version or record deterministic metadata, then report when committed outputs no longer match their generators.
5. **Binary growth is unmanaged.** Blender sources and previews are larger than the GLBs and are stored directly in Git. Monitor repository growth and introduce Git LFS if the asset library grows enough to affect cloning and history size.
6. **Gameplay integration has no contract yet.** Before replacing procedural fallbacks, define model scale, ground/hover offset, forward axis, clip transitions, attack timing, death lifetime, loading/fallback behavior, and the mapping from Rogue monster IDs to asset IDs.
7. **Performance budgets are informal.** Establish limits for triangles, materials, bones, animation key density, and GLB size before producing the full 26-monster roster.

The most valuable next pipeline improvement is the shared asset manifest plus checked-in GLB validator. Together they remove the easiest sources of registration mistakes and make each new monster cheaper to verify.
