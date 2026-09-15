# Procedural room variety and Blender asset plan

## Objective

Make every discovered area feel like a place rather than a repeated grid cell while preserving Rogue's deterministic rules, hidden information, fast browser startup, and first-person readability. Ordinary rooms, caves/mazes, passages, treasure rooms, and special spaces should differ through structure, materials, props, lighting, sound-ready metadata, and controlled variation.

This is a presentation extension. Decorations never alter movement, line of sight, combat, object placement, trap behavior, or random-number draw order unless a later gameplay design explicitly promotes an object into engine state.

## Architectural boundary

The renderer must continue to consume `PlayerObservation`, not `WorldState`. It needs a small visual contract that exposes only what the player has learned.

Add the following observation-only concepts:

```typescript
type VisualRegionKind = 'room' | 'cave' | 'passage' | 'treasure';

interface ObservedCell {
  visibility: 'unknown' | 'remembered' | 'visible';
  appearance: CellAppearance | null;
  visualRegion: null | {
    token: string;       // opaque, stable for this generated level/region
    kind: VisualRegionKind;
    dark: boolean;
  };
}
```

Rules for this contract:

- Unknown cells always have `visualRegion: null`.
- The token must not encode a source room ID, dimensions, coordinates, monster, treasure, or secret-door state.
- A token appears only on an otherwise disclosed cell. It may link two already-known cells visually, but it cannot reveal undiscovered membership or room extent.
- `treasure` becomes observable only when the room's visible contents justify that presentation. Before discovery it uses its ordinary structural kind.
- Save data keeps source-shaped region state. Theme selection and decoration placement remain derived presentation data.
- Theme derivation uses a separate stable hash such as `hash(levelVisualSeed, visualRegionToken, catalogVersion)`. It never consumes `WorldState.rng`.
- Replay hashes exclude presentation themes, prop transforms, animation time, lighting, and asset-loading state.

Add a saved `levelVisualSeed` only if a stable seed cannot be derived from existing non-secret level metadata. If it is added, generate it without changing the gameplay RNG sequence, version the save envelope, and test older-save migration. The preferred implementation is an opaque region token and a deterministic presentation hash supplied at observation time.

## Visual language

Start with five coherent environment families. Each family is a kit with compatible floors, walls, corners, door frames, ceilings, props, decals, and lighting rules.

| Family | Source use | Structural character | Decoration vocabulary | Lighting |
| --- | --- | --- | --- | --- |
| Hewn dungeon | Default ordinary rooms | Cut stone blocks, square corners, shallow ceiling vaults | Benches, chains, crates, iron brackets, worn rugs | Warm sconces with cool ambient fill |
| Natural cave | Mazes and selected irregular rooms | Rough rock, uneven wall depth, stalagmites, broken ceiling silhouette | Loose stones, mineral seams, bones, shallow puddles | Sparse warm lamps or cold luminous minerals |
| Ruined crypt | Deeper ordinary rooms | Dressed stone mixed with collapsed sections, arches, niches | Sarcophagi, urns, memorial slabs, cobweb cards | Low amber pools and deep shadow |
| Abandoned store | Object-rich ordinary rooms | Timber reinforcement and practical shelving | Barrels, sacks, shelves, carts, broken containers | Lantern clusters and dusty neutral fill |
| Treasure chamber | Discovered treasure rooms | More deliberate masonry, framed entrance, focal plinth | Coin scatter, chests, banners, guarded display forms | Strong focal light with restrained gold bounce |

Passages use a narrower connector kit derived from the adjacent region. When two themes meet, the door threshold owns the transition: each side keeps its wall material, while a neutral lintel and floor strip prevent a visible seam.

Depth changes the condition of a family rather than selecting an unrelated art style. Early levels are intact and readable; middle levels add dampness, cracks, roots, and repairs; deep levels add collapse, mineral intrusion, ash, and stronger silhouette variation. Use three condition bands initially: depths 1–8, 9–17, and 18–26+.

## Deterministic theme assignment

Create a versioned `ThemeCatalog` in `src/presentation/three/environment/`.

```typescript
interface ThemeDefinition {
  id: string;
  family: VisualRegionKind | 'room-variant';
  depthRange: readonly [number, number];
  weight: number;
  structuralSet: string;
  propSets: readonly string[];
  decalSet: string | null;
  lightPreset: string;
  density: { sparse: number; normal: number; focal: number };
}
```

Selection is a pure function of the opaque region token, depth band, region kind, and catalog version. Weighted selection must be stable across frame rates, browsers, and object iteration order. Sort catalog candidates by ID before hashing. Adding a new catalog entry must increment the catalog version so existing captures remain reproducible.

Prevent accidental visual repetition with presentation-only adjacency rules:

- Prefer a different family variant from an already-discovered adjacent region.
- Never reroll. Resolve a conflict through a stable ordered fallback derived from the same hash.
- Allow repetition when the catalog has no eligible alternative.
- Keep all decisions local to disclosed region tokens; do not inspect undiscovered neighboring rooms.

## Procedural construction

### Structural pass

Replace one-box-per-wall rendering with modular surfaces generated from disclosed cells:

1. Merge coplanar floor cells into larger geometry where practical.
2. Emit wall faces only on exposed edges rather than placing a solid cube on every wall tile.
3. Choose straight, inner-corner, outer-corner, doorway, end-cap, and ceiling modules from the theme kit.
4. Apply deterministic per-segment variants for chipped edges, rock depth, or masonry pattern.
5. Keep collision and ray-selection surfaces simple and separate from visible meshes.
6. Retain primitive geometry until a GLB asset is ready; late asset completion checks the scene-generation token.

Natural caves need controlled irregularity without changing the grid:

- Offset visible rock vertices within a small inward-only envelope so walkable tile width never shrinks below the comfort minimum.
- Vary wall height and normal direction with a deterministic noise function keyed by region token and edge coordinate.
- Use rock corner caps to hide seams.
- Keep the navigation plane perfectly flat initially. Visual rubble may not become a collision obstacle.
- Limit floor height variation to shader/normal detail in first person to avoid XR discomfort.

### Decoration pass

Generate candidates from semantic anchors, then reject unsafe placements.

Anchor types:

- Wall span: sconces, banners, chains, shelves, cracks.
- Corner: rubble, barrels, urn groups, roots.
- Floor edge: benches, sacks, broken planks.
- Floor center: rugs, tables, plinths, treasure focal arrangements.
- Door threshold: lintels, trim, signs, debris kept outside the walk lane.
- Ceiling: beams, roots, hanging cages, stalactites.

Every asset declares a footprint, clearance class, allowed anchors, rotation rules, density cost, and whether it may overlap another decoration. The placement system must reserve:

- The center walk channel of every known traversable tile.
- Door cells and one approach cell on each side.
- Stairs, revealed traps, visible objects, visible monsters, and the player's cell.
- Head clearance and controller reach volume for XR.
- A clean visual area around actionable objects so decorations do not look collectible.

Use deterministic blue-noise-like candidate ordering or hashed anchor ordering. Do not call `Math.random`. A decoration budget per region prevents clutter and gives each theme sparse, normal, and focal zones. Treasure presentation may be denser, but decorative coins must be visually distinct from the collectible gold entity.

### Material, decal, and light pass

- Use a shared PBR material library with base color, normal, roughness, and optional ambient-occlusion textures.
- Pack grayscale channels where the selected glTF/browser workflow supports it.
- Prefer trim sheets and tileable materials for architecture; reserve unique texture sets for focal props.
- Use decals sparingly for cracks, stains, moss, chalk marks, and mineral veins. Decals must not resemble trap indicators or item glyph colors.
- Limit dynamic shadow-casting lights. Use one player light, a small capped number of nearby theme lights, emissive materials, and baked-looking ambient terms.
- Darkness changes exposure and enabled local lights. It does not remove geometry the observation already remembers.
- Assign a stable light priority and distance rule so activation does not flicker as the camera crosses a boundary.

## Blender production pipeline

### Repository layout

```text
art/
  blender/
    kits/dungeon/
    kits/cave/
    kits/crypt/
    kits/store/
    kits/treasure/
    props/common/
    creatures/
    source_textures/
  export/
    environments/
    props/
    creatures/
public/assets/
  environments/
  props/
  creatures/
  manifests/
tools/blender/
  export_glb.py
  validate_scene.py
  make_preview.py
```

Commit `.blend` source files under `art/blender/` when licensing permits. Commit optimized runtime `.glb` files under `public/assets/`. Never edit an exported GLB by hand; regenerate it from its Blender source and checked-in export settings.

### Scene standard

- Blender units: metric, one Blender unit equals one world meter/tile unit.
- Up axis: +Z in Blender; export glTF with the standard conversion and verify Three.js orientation.
- Grid module: 1 m × 1 m footprint. Standard visible wall height: 1.8 m to match the current renderer.
- Object origin: floor center for props; tile center for modular floor/wall pieces; hinge line for doors; rig root at ground between the feet for creatures.
- Apply object scale and rotation before export. Mesh scale must be `(1,1,1)` unless an intentional rig workflow requires otherwise.
- Use descriptive ASCII names: `env_cave_wall_straight_a`, `prop_crypt_urn_cluster_b`, `mon_aquator_body`.
- No duplicate object, material, image, armature, or action names in an exported scene.
- One asset collection per exportable GLB. Helper collections start with `_` and are excluded.

### Modular environment kit requirements

Each family initially ships:

- 3 straight wall variants
- 2 inner and 2 outer corner variants
- 2 floor variants plus one damaged overlay
- 1 ceiling module
- 2 doorway frames and 1 neutral transition frame
- 1 wall end cap
- 6 small props, 3 medium props, and 1 focal prop
- 4 decals or decal-atlas entries
- Simple collision/raycast proxy meshes where the tile proxy is insufficient

All seams must be checked with four identical modules in a row and a closed 3×3 room. Cave modules need overlap skirts or caps so deterministic deformation cannot reveal gaps.

### Creature asset requirements

Keep the procedural red actor as the fallback. Introduce detailed monsters in batches by silhouette family rather than attempting 26 unique models immediately:

1. Humanoid: hobgoblin, orc, zombie, vampire, medusa base.
2. Quadruped: jackal and related grounded creatures.
3. Serpentine: rattlesnake and floating eye-like variants.
4. Insect/avian: kestrel, bat, floating forms.
5. Large: troll, griffin, dragon.
6. Amorphous/special: slime, mimic/Xeroc, venus flytrap.

Each rigged creature GLB requires independent skeleton cloning at runtime and these actions where applicable: `idle`, `move`, `attack`, `hurt`, `death`. Action names are lowercase and exact. Animation callbacks only end or recycle presentation state; they never submit a game action.

Creature budgets for the first pass:

- Ordinary monster: 5k–15k triangles, one 1K texture set.
- Large/focal monster: 20k–40k triangles, up to one 2K texture set.
- Two LODs for large creatures; one optimized mesh is sufficient for small creatures until profiling shows a need.
- No globally disabled frustum culling. Validate bounds after animation.

### Materials and textures

- Use Principled BSDF with nodes supported by glTF export.
- Bake procedural Blender materials to image textures before export.
- Prefer PNG for alpha-cutout assets and KTX2/Basis compression for runtime delivery after the basic pipeline is stable.
- Use power-of-two texture sizes and consistent texel density within a kit.
- Keep texture color spaces correct: base color/emissive in sRGB; normal, roughness, metallic, and AO as non-color data.
- Do not embed unused textures, cameras, lights, hidden high-poly meshes, or sculpt data in runtime exports.

### Automated Blender export

Pin a Blender LTS version in `art/README.md`. Run exports headlessly:

```text
blender --background asset.blend --python tools/blender/export_glb.py -- --collection env_cave_wall_straight_a
```

The export script should:

1. Open only the requested export collection.
2. Validate naming, transforms, dimensions, missing textures, material count, triangle budget, UV maps, armature scale, and required actions.
3. Export glTF Binary with explicit, versioned settings.
4. Write a sidecar manifest containing asset ID, source `.blend`, source hash, Blender version, export profile, dimensions, triangle count, materials, textures, animations, license record, and runtime tags.
5. Fail without replacing the previous good GLB when validation fails.
6. Optionally render fixed-angle preview images for review.

CI does not need Blender on every code test. Run manifest/schema and GLB structural validation on normal changes; run full Blender regeneration in a dedicated art job or locally when `.blend` sources change.

## Runtime asset catalog

Create a checked-in manifest consumed by TypeScript rather than scattering URLs through renderer code.

```typescript
interface EnvironmentAssetRecord {
  id: string;
  url: string;
  kind: 'floor' | 'wall' | 'corner' | 'doorFrame' | 'ceiling' | 'prop' | 'decal';
  themeIds: string[];
  anchors: string[];
  footprint: { width: number; depth: number; clearance: string };
  variants: number;
  lods: string[];
  castsShadow: boolean;
  licenseId: string;
}
```

Validate manifests during `npm test`. Resolve URLs before passing them to the existing `AssetCache`; filename-only keys are forbidden. Loaded templates are cloned per instance. Animated creatures use skeleton-aware cloning. Geometry, materials, and textures shared across instances retain reference-counted ownership. A room unload releases leases but cannot dispose a resource still used by another active room.

## Performance budgets

Initial desktop/XR targets:

- Activate the player's region, its doorway transitions, and a short passage margin in first person.
- Keep tabletop mode complete but use instancing, merged static geometry, simplified materials, and reduced lighting.
- Cap active decorative props at 60 near first person before profiling; prefer instancing for repeated rocks, urns, barrels, and coins.
- Cap shadow-casting local lights at four, selected by stable distance and priority.
- Avoid rebuilding unchanged region geometry on every observation update. Cache by level visual key, disclosed-cell signature, region token, theme catalog version, and quality profile.
- Load the primitive shell immediately. Stream structural art first, then focal props, then secondary decoration.
- Measure CPU frame time, GPU frame time where available, draw calls, triangles, texture memory estimate, and active lights in the debug inspector.

Treat these as starting budgets. Target-headset profiling decides final limits.

## Implementation phases

### 14.1 — Safe visual-region contract

- Add `visualRegion` to observed cells and populate it only for visible/remembered cells.
- Create opaque stable region tokens without exposing source IDs.
- Add privacy tests proving unknown cells contain no token, kind, darkness, or theme data.
- Version save data only if a new saved visual seed is unavoidable.

Completion: reading observations cannot infer an undiscovered room's presence, extent, or theme; replay hashes remain unchanged.

Implemented 2026-09-14 with creation-time `RoomDesign` metadata. The first implementation stores primitive decoration placements directly with each generated room, uses a cosmetic hash that does not consume Rogue RNG, clears door approaches after passages are connected, and filters all visual metadata through disclosed observation cells. Detailed modular meshes and Blender-authored replacements remain in later slices.

### 14.2 — Viewport-first game shell and HUD

- Make the first-person canvas the dominant surface: at least 70% of a 1366×768 viewport and the full available height after the compact status bar.
- Put HP, hunger, depth, equipped weapon, gold, and the most recent message in a restrained overlay that remains readable against light and dark rooms.
- Add a small center crosshair and context prompt for doors, stairs, items, and adjacent actors using observation data only.
- Move seed, world type, save/load, replay, inspector, raw events, and reveal controls into keyboard-accessible collapsible debug drawers.
- Keep touch-sized primary actions available below the viewport at narrow breakpoints; desktop keyboard play must not require page scrolling.
- Preserve the map, orbit, and tabletop selectors as secondary presentation tools without restarting the session.

Completion: first-person gameplay is visually dominant at desktop and mobile widths, debug tools remain reachable, focus indicators and labels pass accessibility checks, and switching the layout does not change engine state or replay hashes.

### 14.3 — Live animated monster integration

- Replace duplicated viewer allowlists with a typed asset manifest mapping each Rogue monster definition to GLB URL, scale, ground/hover offset, forward axis, animation names, and fallback shape.
- Load visible monsters through the existing cache and clone skinned models independently; do not load or instantiate monsters absent from `PlayerObservation`.
- Drive `idle`, `move`, `attack`, `hurt`, and `death` transitions from resolved observation changes and presentation events.
- Retain the primitive actor until a model is ready or after a load failure. Late results must check the scene-generation token before attachment.
- Add animation crossfades, conservative bounds, disposal tests, and a debug label for model/fallback state.

Completion: multiple instances animate independently, hidden actors remain private, failed and delayed loads preserve playability, and the same recorded actions produce identical engine hashes with detailed models enabled or disabled.

### 14.4 — Deterministic theme, material, and light catalogs

Implemented material slice 2026-09-15: `room-materials.ts` defines a versioned, typed palette for all five room families and four stable procedural variants per floor/wall surface. The Three.js renderer reads disclosed `visualRegion` data, applies the appropriate textured material, and retints its existing hemisphere and player lamp when the player enters a themed region. Texture and frame-material caches are disposed on view teardown; an unavailable 2D canvas uses flat-material fallback. Distinct browser pixel signatures and live dungeon/store captures verify the theme language. The creature asset manifest remains in 14.3; structural geometry and authored environment maps remain in 14.5 and 14.8.

- Add the versioned theme and asset-manifest schemas.
- Implement pure weighted theme selection and adjacency fallback.
- Add Hewn Dungeon and Natural Cave definitions using existing primitive materials.
- Display region token/theme in the debug inspector only for disclosed cells.

Completion: the same save and observation sequence produces identical theme IDs and decoration seeds in Chromium and Firefox without advancing gameplay RNG.

### 14.5 — Structural environment builder

- Split the Three.js world into persistent region groups.
- Emit exposed wall faces, corner types, doorway transitions, floors, and ceilings.
- Add deterministic cave-edge deformation within the collision-safe envelope.
- Cache unchanged region groups and preserve primitive fallback during asynchronous replacement.

Completion: ordinary rooms and cave/maze areas have clearly different silhouettes, no seams, and identical traversable space.

### 14.6 — Procedural decoration system

Chest-and-torch follow-up implemented 2026-09-15: the existing `crate` prop ID now uses a locked, arched treasure-chest GLB and matching primitive fallback, including treasure-room decoration eligibility. Each chest faces inward from its nearest room wall so its lock reads from ordinary play. Ordinary rooms generate stable inward-facing torch anchors along wall spans during room creation, then remove anchors near exits when passages are linked. Torches remain observation-filtered; remembered torches retain a mesh but only currently visible torches illuminate the scene, capped at four nearest local point lights with no shadows. The Blender source, GLB, preview, and self-contained validation are in the room-prop pipeline. These visual lights do not alter source darkness or gameplay RNG. Semantic furniture anchors and full environment-kit geometry remain later 14.6/14.8 work.

- Generate semantic anchors and exclusion volumes.
- Add deterministic budgets, density zones, and overlap rejection.
- Add primitive placeholder props for all five theme families.
- Keep door approaches, stairs, traps, items, monsters, and XR reach lanes clear.

Completion: repeated seeds reproduce decoration exactly; 100 generated levels have no blocked interaction lanes or misleading collectible decoration.

### 14.7 — First-person feedback

- Add a subtle weapon or hand presence tied to equipped items, with presentation-only idle, move, attack, and recoil animation.
- Add restrained head bob, footstep cadence, doorway response, and camera impulse with reduced-motion and XR-safe profiles.
- Translate resolved combat events into hit flashes, directional damage vignette, contact particles, floating dust, and concise message overlays.
- Add interaction highlights that cannot be confused with collectible objects, traps, or authoritative targeting state.
- Define sound-ready cues and mixer groups, but keep audio optional and derived from the same resolved event stream.

Completion: movement and combat have immediate readable feedback, all effects can be disabled without changing gameplay, reduced-motion mode removes camera impulses, and XR never applies artificial head motion.

### 14.8 — Blender environment pipeline and complete kits

- Pin Blender LTS and add source/export folder conventions.
- Implement headless validation, GLB export, manifests, and preview renders.
- Produce the first complete Hewn Dungeon and Natural Cave modular kits.
- Verify scale, axes, seams, materials, disposal, URL cache keys, and primitive fallback.

Completion: a clean checkout can regenerate both kits from `.blend` sources and the browser loads them without changing engine state.

Continue the pipeline with the complete theme set:

- Produce Hewn Dungeon, Natural Cave, Ruined Crypt, Abandoned Store, Treasure Chamber, and connector kits.
- Add decals, bounded local lights, depth-condition variants, and optional sound-ready region metadata.
- Add quality profiles for desktop, tabletop, and target XR hardware.

Completion: theme changes are immediately recognizable in first person, transitions are coherent, darkness remains readable, and performance stays within the measured budget.

### 14.9 — Quality profiles, visual regression, and headset acceptance

- Add fixed-seed screenshots for every theme in first-person and tabletop views.
- Test hidden-information privacy, deterministic placement, seam cases, disposal, remounting, and context loss.
- Profile dense rooms and transitions on desktop and the target headset.
- Run the existing XR device checklist with the decorated environments.

Completion: visual baselines are approved, privacy tests pass, no resource growth appears across repeated level transitions, and headset comfort/performance findings are recorded.

## Recommended production order

Implement the visible game shell first, then connect the creature assets already produced. Follow with one complete material-and-structure vertical slice containing Hewn Dungeon and Natural Cave, one common prop set, and the first-person feedback layer. Test that slice in desktop first person and XR before producing the remaining environment kits. The completed procedural monster library should be integrated through the shared manifest rather than recreated.
