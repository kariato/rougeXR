# Hunyuan monster collection v1

The 26 images in `art/monster-references/hunyuan-v1/` were generated individually
with the built-in ImageGen tool. `prompts.json` records the complete prompt set,
monster identities, intended height, and anatomical family.

The local mesh pipeline uses the existing sibling `zxr` installation:

```sh
/Volumes/NVME/Source/zxr/out/asset-tools/shape-env/bin/python -u tools/monsters/generate_meshes.py --all --wait-for-references
/Volumes/NVME/Source/zxr/out/asset-tools/blender-env/bin/python -u tools/monsters/animate_meshes.py --all --wait-for-meshes
/Volumes/NVME/Source/zxr/out/asset-tools/blender-env/bin/python -u tools/monsters/bake_textures.py
node tools/monsters/validate.mjs
/Volumes/NVME/Source/zxr/out/asset-tools/shape-env/bin/python tools/monsters/review.py
```

Hunyuan3D 2.0 Turbo runs locally through Hunyuan3D-Swift/MLX, with the installed
8-bit weights, eight steps, seed 42, and octree resolution 256. Each raw mesh is
retained before cleanup. Runtime candidates have at most 12,000 triangles.
Inference runs serially. Use `--zxr-root` to point generation at another existing
installation; no weights, dependencies, or remote services are downloaded.
The environment needs access to the Mac GPU; a sandboxed Metal import fails.

Animation fits the original rougeXR species-specific armature to the new shape,
transfers up to four normalized skin weights from neighbouring template vertices,
and retains the authored `idle`, `move`, `attack`, `hurt`, and `death` motions.
One-shot motions receive ground-contact correction on the reconstructed geometry.
These are authored motions on generated meshes, not AI-generated motion. Automatic
skin transfer is a starting point for manual joint cleanup, not production rigging.

Textures begin with front-reference projection fitted to the silhouette width at each height and spatially blurred rear colour.
The finishing script unwraps a new UV set and bakes a smooth normal-based blend
into one embedded 2048-pixel albedo atlas. It removes harsh projection boundaries;
it does not infer an accurate back view or perform learned multiview painting.

Every monster's ignored `out/monsters-v1/<id>/` folder contains:

- `raw.glb` and `raw.json`: retained Hunyuan inference and input hash.
- `candidate.glb` and `candidate.json`: optimized textured mesh and provenance.
- `animated.blend` and `animated.glb`: editable rig and self-contained export.
- `animation.json`: clip, skin, source-hash, deformation, and texture metadata.
- `albedo.png`, `front.png`, `side.png`, and `rear.png`: texture and review renders.
- The accompanying Tencent model license and notice.

The local gallery is `/out/monsters-v1/index.html` on the Vite development server.
The animation viewer supports `/model-preview.html?model=aquator&set=hunyuan-v1`.
The original model collection remains selectable. Reviewed copies are bundled for production in `public/assets/hunyuan-v1/creatures/`; the game uses this new collection. Stage the published collection with `node tools/assets/publish-hunyuan.mjs`.

`node tools/monsters/validate.mjs` independently loads the exported GLBs in Three.js,
checks embedded resources, triangle counts, all skin influences, exact clip names,
actual vertex deformation, idle/move loop closure, and ground contact. The review
script checks transparent references and builds the gallery and contact sheets.

Run the optional browser review serially to avoid competing WebGL contexts:

```sh
ROUGEXR_TEST_LOCAL_MONSTERS=1 npx playwright test tests-e2e/hunyuan-monsters.spec.ts --workers=1
```

Generation and rigging reuse matching files. Changed inputs are rejected instead
of silently replacing source work. `--reproject` explicitly rebuilds a candidate
texture from retained raw geometry. `--rebuild-animation` explicitly rebuilds the
derived rig/animation and clears the subsequent texture finish; rerun baking after
using it. Preserve manual Blender edits in a separate version before rebuilding.

## Completed collection verification

All 26 final exports (130 clips) pass the independent Three.js deformation check. All 52 local browser checks pass in Chromium and Firefox. The production build and TypeScript checks pass. These checks establish loading and animation structure; the collection remains an art-review draft, with approximate rear textures and automatic joint weights. The tracked `art/monster-references/hunyuan-v1/asset-manifest.json` records each final export hash and path.
