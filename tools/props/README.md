# Generated prop collection v1

Six review assets: door, chest, torch, urn, pillar, and potion. Eight individual
transparent references were made with the built-in ImageGen tool; exact prompts
and component dimensions are recorded in `art/prop-references/hunyuan-v1/prompts.json`.
The door leaf/frame and chest base/lid are separate image-to-mesh components. A ninth supporting ImageGen edit supplies a straight-on chest-front texture.

```sh
/Volumes/NVME/Source/zxr/out/asset-tools/shape-env/bin/python -u tools/props/generate_meshes.py --wait-for-references
/Volumes/NVME/Source/zxr/out/asset-tools/shape-env/bin/python tools/props/prepare_textures.py
/Volumes/NVME/Source/zxr/out/asset-tools/blender-env/bin/python -u tools/props/finish_assets.py --wait-for-meshes
node tools/props/validate.mjs
/Volumes/NVME/Source/zxr/out/asset-tools/shape-env/bin/python tools/props/review.py
```

Generation reuses zxr's installed Hunyuan3D 2.0 Turbo / MLX runtime and 8-bit local
weights. It uses eight steps, seed 42, and octree resolution 256, with serial GPU
inference. `--zxr-root` overrides the sibling project location. No weights or Python
packages are downloaded. Matching inputs are reused; changed inputs require a new
version. Raw inference meshes and their hashes remain in `out/props-v1/parts/`.

The Blender finishing stage welds triangle-soup seams before Boolean operations,
repairs non-manifold chest geometry with a budgeted voxel remesh, clears the doorway and chest cavity, levels the reconstructed chest rim, scales
components to matching physical dimensions, and bakes one embedded 1024-pixel
albedo per component. It authors `open` and `close` clips on named rigid hinge
nodes. These clips move the door leaf or chest lid while keeping the frame or base
stationary. Torch, urn, pillar, and potion are static. The torch is unlit; the
potion uses opaque coloured glass rather than optical transmission.

Final assets are in ignored `out/props-v1/<id>/`: `model.glb`, packed editable
`model.blend`, albedo images, front/side/rear/perspective renders, opening renders
for door/chest, `asset.json` provenance, and the accompanying Tencent notice and
license. `--rebuild` explicitly regenerates derived files; preserve any manual
Blender edits in a new version before using it.

`validate.mjs` independently reads the exported GLBs in Three.js. It checks
embedded resources, mesh budgets, finite geometry, floor alignment, clip names,
stationary components, fixed hinge origins, matching open/close endpoints, actual
vertex movement, a clear doorway passage, and the chest's open interior/floor.
The gallery builder verifies image alpha and file hashes and records a tracked
`art/prop-references/hunyuan-v1/asset-manifest.json` after all six exports pass.

Local gallery: `/out/props-v1/index.html`. Interactive model review:
`/model-preview.html?model=chest&set=hunyuan-props-v1`. The collection is available
in both development and production model viewers. The game uses published copies fitted to the original prop footprints in `public/assets/hunyuan-v1/props/`. Run `node tools/assets/publish-hunyuan.mjs` to stage these copies. Front
projection and blurred rear colour are approximations; generated proportions,
materials, and geometry remain art-review drafts.

```sh
ROUGEXR_TEST_LOCAL_PROPS=1 npx playwright test tests-e2e/hunyuan-props.spec.ts --workers=1
```

## Verification

All six exported props pass the independent Three.js geometry, hinge, doorway and cavity checks. Twelve prop browser checks pass across Chromium and Firefox, along with six monster-viewer regressions. TypeScript and production build checks pass. The six final GLBs total 12,255 vertices and 15,205 triangles. Rear textures remain approximations.
