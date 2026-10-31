"""Generate versioned local Hunyuan meshes from the recorded rougeXR references.

Uses zxr's already-installed MLX runtime and front-reference texture projection.
GPU inference is serial. Existing matching raw meshes are reused, never replaced.
"""
from pathlib import Path
import argparse
import hashlib
import importlib.util
import json
import os
import time

ROOT = Path(__file__).resolve().parents[2]
REFERENCES = ROOT / 'art/monster-references/hunyuan-v1'
OUTPUT = ROOT / 'out/monsters-v1'


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('monsters', nargs='*')
    parser.add_argument('--zxr-root', type=Path, default=ROOT.parent / 'zxr')
    parser.add_argument('--available', action='store_true')
    parser.add_argument('--all', action='store_true')
    parser.add_argument('--wait-for-references', action='store_true')
    parser.add_argument('--reproject', action='store_true')
    args = parser.parse_args()
    os.environ['HF_HUB_OFFLINE'] = '1'
    os.environ['TOKENIZERS_PARALLELISM'] = 'false'
    spec = importlib.util.spec_from_file_location('zxr_generate', args.zxr_root / 'tools/assets/generate.py')
    helper = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helper)
    catalog = json.loads((REFERENCES / 'prompts.json').read_text())['monsters']
    entries = {entry['id']: entry for entry in catalog}
    identities = args.monsters or ([e['id'] for e in catalog] if args.all else [e['id'] for e in catalog if (REFERENCES / e['reference']).exists()] if args.available else [])
    if not identities:
        parser.error('Choose monster IDs or --available')
    pipe = None
    for identity in identities:
        entry = entries[identity]
        reference = REFERENCES / entry['reference']
        while not reference.exists() and args.wait_for_references:
            print('WAIT reference ' + identity, flush=True)
            time.sleep(10)
        directory = OUTPUT / identity
        directory.mkdir(parents=True, exist_ok=True)
        options = {'referenceSha256': digest(reference), 'pipeline': helper.PIPELINE,
                   'projectionHelperSha256': digest(args.zxr_root / 'tools/assets/generate.py'),
                   'heightMetres': entry['heightMetres'], 'targetTriangles': 12000,
                   'textureMethod': 'height-slice-fitted reference projection; blurred spatial rear v3'}
        key = hashlib.sha256(json.dumps(options, sort_keys=True).encode()).hexdigest()
        record = directory / 'candidate.json'
        if record.exists():
            old = json.loads(record.read_text())
            if old['inputHash'] == key and old['sha256'] == digest(directory / 'candidate.glb'):
                print('REUSE ' + identity, flush=True)
                continue
            if args.reproject and old.get('referenceSha256') != options['referenceSha256']:
                raise RuntimeError('Reprojection requires the same original reference: ' + identity)
            if not args.reproject:
                raise RuntimeError('Existing candidate differs; preserve it and choose a new version: ' + identity)
        started = time.monotonic()
        raw_path = directory / 'raw.glb'
        raw_record = directory / 'raw.json'
        if raw_path.exists():
            import trimesh
            meta = json.loads(raw_record.read_text())
            if (meta['inputHash'] != key and not args.reproject) or meta['sha256'] != digest(raw_path):
                raise RuntimeError('Raw candidate does not match inputs: ' + identity)
            raw = trimesh.load(raw_path, force='mesh')
        else:
            import mlx.core as mx
            from hy3dmlx.pipeline import Hunyuan3DShapePipeline
            if pipe is None:
                print('LOAD local Hunyuan3D 2.0 Turbo / MLX', flush=True)
                pipe = Hunyuan3DShapePipeline.from_pretrained(
                    str(args.zxr_root / 'out/asset-tools/weights/hunyuan2-turbo/hunyuan3d-dit-v2-0-turbo'),
                    dtype=mx.float16, quantize=8)
            print('GENERATE ' + identity, flush=True)
            raw = pipe.generate(str(reference), num_inference_steps=8, guidance_scale=5,
                                octree_resolution=256, seed=42, octree_decode=True)
            raw.export(raw_path)
            raw_record.write_text(json.dumps({'inputHash': key, 'sha256': digest(raw_path)}, indent=2) + '\n')
        candidate, components = helper.prepare(raw, reference, 12000, [1, entry['heightMetres'], 1])
        # Keep spatial colour on the back rather than the zxr row-median strip,
        # which puts horizontal hand-colour bands across an unrelated torso.
        # This remains an explicit single-view approximation, not learned paint.
        from PIL import Image, ImageFilter
        from scipy.ndimage import distance_transform_edt
        import numpy as np
        source_pixels = np.array(Image.open(reference).convert('RGBA'))
        mask = source_pixels[:, :, 3] > 127
        nearest = distance_transform_edt(~mask, return_distances=False, return_indices=True)
        extended = Image.fromarray(source_pixels[:, :, :3][tuple(nearest)])
        atlas = Image.new('RGB', (1024, 1024))
        atlas.paste(extended.resize((768, 1024), Image.Resampling.LANCZOS), (0, 0))
        atlas.paste(extended.filter(ImageFilter.GaussianBlur(18)).resize((256, 1024), Image.Resampling.LANCZOS), (768, 0))
        back = candidate.visual.uv[:, 0] > .75
        yy, xx = np.where(mask)
        lo, hi = candidate.bounds
        # Match the silhouette width at each height. A global bounding-box
        # projection loses a centaur's face when its horse body widens the box.
        from scipy.ndimage import gaussian_filter1d
        height_fraction = np.clip((candidate.vertices[:, 1] - lo[1]) / (hi[1] - lo[1]), 0, 1)
        bins = np.minimum((height_fraction * 127).astype(int), 127)
        left = np.full(128, np.nan); right = np.full(128, np.nan)
        for level in range(128):
            selected = candidate.vertices[bins == level, 0]
            if len(selected): left[level], right[level] = selected.min(), selected.max()
        valid = np.where(np.isfinite(left))[0]
        left = gaussian_filter1d(np.interp(np.arange(128), valid, left[valid]), 1)
        right = gaussian_filter1d(np.interp(np.arange(128), valid, right[valid]), 1)
        row_left = np.full(mask.shape[0], np.nan); row_right = row_left.copy()
        for row in range(mask.shape[0]):
            selected = np.where(mask[row])[0]
            if len(selected): row_left[row], row_right[row] = selected.min(), selected.max()
        valid = np.where(np.isfinite(row_left))[0]
        row_left = np.interp(np.arange(mask.shape[0]), valid, row_left[valid])
        row_right = np.interp(np.arange(mask.shape[0]), valid, row_right[valid])
        rows = np.clip(np.rint(yy.max() - height_fraction * (yy.max()-yy.min())).astype(int), 0, mask.shape[0]-1)
        horizontal = np.clip((candidate.vertices[:, 0] - left[bins]) / np.maximum(right[bins]-left[bins], .001), 0, 1)
        source_u = (row_left[rows] + horizontal * (row_right[rows]-row_left[rows])) / mask.shape[1]
        candidate.visual.uv[~back, 0] = source_u[~back] * .75
        candidate.visual.uv[back, 0] = .75 + source_u[back] * .25
        candidate.visual.material.baseColorTexture = atlas
        candidate.export(directory / 'candidate.glb')
        for source, target in [('TENCENT-HUNYUAN-3D-2.0-LICENSE.txt', 'TENCENT-HUNYUAN-3D-2.0-LICENSE.txt')]:
            (directory / target).write_bytes((args.zxr_root / 'src/prototype/assets' / source).read_bytes())
        (directory / 'NOTICE.txt').write_text(
            'Tencent Hunyuan 3D 2.0 is licensed under the Tencent Hunyuan 3D 2.0 Community License Agreement, Copyright © 2025 Tencent. All Rights Reserved. The trademark rights of “Tencent Hunyuan” are owned by Tencent or its affiliate.\n'
            'Local review asset. Not included in the rougeXR production build.\n')
        report = {'format': 'rougexr-hunyuan-monster-v1', 'id': identity, 'inputHash': key, **options,
                  'rawTriangles': len(raw.faces), 'triangles': len(candidate.faces), 'componentsBeforeCleanup': components,
                  'boundsMetres': candidate.bounds.tolist(), 'sha256': digest(directory / 'candidate.glb'),
                  'seconds': round(time.monotonic() - started, 2), 'status': 'mesh-ready; rig pending',
                  'limitations': ['Single-view reference texture; side and rear colours are approximate.',
                                  'Reconstructed topology and animation deformation require visual review.']}
        record.write_text(json.dumps(report, indent=2) + '\n')
        print('MESH READY ' + identity + ' ' + str(report['seconds']) + 's', flush=True)
        del raw, candidate
        if pipe is not None:
            mx.clear_cache()


if __name__ == '__main__':
    main()
