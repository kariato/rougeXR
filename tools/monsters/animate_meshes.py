"""Fit rougeXR's authored species rigs and five clips to new Hunyuan meshes.

Run with zxr/out/asset-tools/blender-env/bin/python. Outputs stay in ignored out/.
The original procedural geometry is used only to transfer skin weights; it is
removed from the exported result. No original asset is overwritten.
"""
from pathlib import Path
import argparse
import hashlib
import json
import math
import time
import bpy
import numpy as np
from mathutils import Matrix, Vector, Quaternion
from mathutils.kdtree import KDTree

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / 'out/monsters-v1'
CLIPS = ['idle', 'move', 'attack', 'hurt', 'death']


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def points(obj):
    return np.array([tuple(obj.matrix_world @ vertex.co) for vertex in obj.data.vertices])


def evaluated_points(obj):
    graph = bpy.context.evaluated_depsgraph_get()
    graph.update()
    evaluated = obj.evaluated_get(graph)
    return np.array([tuple(evaluated.matrix_world @ vertex.co) for vertex in evaluated.data.vertices])


def reset_pose(rig):
    for bone in rig.pose.bones:
        bone.matrix_basis = Matrix.Identity(4)


def render_view(scene, target, bounds, path, angle=0):
    center = Vector(((bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2,
                     (bounds[0][2] + bounds[1][2]) / 2))
    radius = max(bounds[1] - bounds[0])
    camera = scene.camera
    theta = math.radians(angle)
    camera.location = center + Vector((math.sin(theta) * radius * 3, -math.cos(theta) * radius * 3, radius * .35))
    camera.rotation_euler = (center - camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = radius * 1.32
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def process(identity, entry, force=False):
    started = time.monotonic()
    directory = OUTPUT / identity
    candidate = directory / 'candidate.glb'
    source = ROOT / f'art/blender/creatures/{identity}.blend'
    metadata = directory / 'animation.json'
    source_hash = digest(source)
    candidate_hash = digest(candidate)
    script_hash = digest(Path(__file__))
    if metadata.exists() and not force:
        previous = json.loads(metadata.read_text())
        if (previous.get('candidateSha256') == candidate_hash and previous.get('rigSourceSha256') == source_hash
                and previous.get('scriptSha256') == script_hash and previous['sha256'] == digest(directory / 'animated.glb')):
            print('REUSE ANIMATION ' + identity, flush=True)
            return
        raise RuntimeError('Animation inputs differ; use --rebuild-animation to explicitly rebuild derived animation')
    bpy.ops.wm.open_mainfile(filepath=str(source))
    scene = bpy.context.scene
    bpy.context.preferences.filepaths.save_version = 0
    rig = next(obj for obj in scene.objects if obj.type == 'ARMATURE')
    templates = [obj for obj in scene.objects if obj.type == 'MESH' and len(obj.vertex_groups)]
    tracks = {track.name: track for track in rig.animation_data.nla_tracks}
    if set(tracks) != set(CLIPS):
        raise ValueError('Unexpected source clips: ' + str(list(tracks)))
    for track in tracks.values():
        track.mute = True
    rig.animation_data.action = None
    reset_pose(rig)
    scene.frame_set(1)
    bpy.context.view_layer.update()
    template_points = np.concatenate([points(obj) for obj in templates])
    template_lo, template_hi = template_points.min(axis=0), template_points.max(axis=0)
    template_weights = []
    bone_names = {bone.name for bone in rig.data.bones}
    for obj in templates:
        names = {group.index: group.name for group in obj.vertex_groups if group.name in bone_names}
        template_weights.extend([{names[group.group]: group.weight for group in vertex.groups if group.group in names}
                                 for vertex in obj.data.vertices])
    original_objects = set(scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(candidate))
    new_objects = set(scene.objects) - original_objects
    meshes = [obj for obj in new_objects if obj.type == 'MESH']
    if len(meshes) != 1:
        raise ValueError('Expected one reconstructed mesh, got ' + str(len(meshes)))
    mesh = meshes[0]
    mesh.name = identity + '_hunyuan_mesh'
    world_points = points(mesh)
    # Bake imported Y-up conversion to native Blender Z-up coordinates.
    for vertex, point in zip(mesh.data.vertices, world_points):
        vertex.co = point
    mesh.parent = None
    mesh.matrix_world = Matrix.Identity(4)
    hover = .5 if entry['body'] == 'winged' else .1 if entry['body'] == 'spectral' else 0
    for vertex in mesh.data.vertices:
        vertex.co.z += hover
    new_points = points(mesh)
    new_lo, new_hi = new_points.min(axis=0), new_points.max(axis=0)
    scaling = (new_hi - new_lo) / np.maximum(template_hi - template_lo, 1e-6)
    offset = new_lo - template_lo * scaling
    fitted = template_points * scaling + offset
    tree = KDTree(len(fitted))
    for index, point in enumerate(fitted):
        tree.insert(Vector(point), index)
    tree.balance()
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    for bone in rig.data.edit_bones:
        bone.use_connect = False
    for bone in rig.data.edit_bones:
        bone.head = np.array(bone.head) * scaling + offset
        bone.tail = np.array(bone.tail) * scaling + offset
    bpy.ops.object.mode_set(mode='OBJECT')
    groups = {name: mesh.vertex_groups.new(name=name) for name in bone_names}
    distances = []
    for vertex in mesh.data.vertices:
        neighbours = tree.find_n(vertex.co, 4)
        distances.append(neighbours[0][2])
        weights = {}
        for _, index, distance in neighbours:
            factor = 1 / max(distance, .002) ** 2
            for name, weight in template_weights[index].items():
                weights[name] = weights.get(name, 0) + weight * factor
        strongest = sorted(weights.items(), key=lambda item: -item[1])[:4]
        total = sum(weight for _, weight in strongest)
        if total <= 0:
            raise ValueError('Unweighted vertex ' + str(vertex.index))
        for name, weight in strongest:
            groups[name].add([vertex.index], weight / total, 'REPLACE')
    mesh.parent = rig
    modifier = mesh.modifiers.new('Species skin', 'ARMATURE')
    modifier.object = rig
    # Remove the low-poly source geometry and glTF importer helpers.
    for obj in list(scene.objects):
        if obj not in (mesh, rig):
            bpy.data.objects.remove(obj, do_unlink=True)
    # Ground one-shot motions against the actual reconstructed geometry. Preserve
    # in-place gait and hover; death ends in contact with the floor.
    root = next(bone for bone in rig.pose.bones if bone.parent is None)
    inverse_root = root.bone.matrix_local.to_quaternion().inverted()
    sample_report = {}
    clip_bounds = []
    for name in CLIPS:
        reset_pose(rig)
        action = tracks[name].strips[0].action
        rig.animation_data.action = action
        frames = [int(frame) for frame in action.frame_range]
        all_lo, all_hi = [], []
        moving = []
        baseline = None
        for frame in range(frames[0], frames[1] + 1):
            scene.frame_set(frame)
            bpy.context.view_layer.update()
            actual = evaluated_points(mesh)
            floor = 0 if name == 'death' else hover
            correction = max(0, floor - actual[:, 2].min())
            if correction > 1e-5:
                root.location += inverse_root @ Vector((0, 0, correction))
                root.keyframe_insert(data_path='location', frame=frame, group=root.name)
                bpy.context.view_layer.update()
                actual = evaluated_points(mesh)
            if not np.isfinite(actual).all():
                raise ValueError('Nonfinite deformation in ' + name)
            if baseline is None:
                baseline = actual.copy()
            moving.append(float(np.max(np.linalg.norm(actual - baseline, axis=1))))
            all_lo.append(actual.min(axis=0))
            all_hi.append(actual.max(axis=0))
        bounds = np.array([np.min(all_lo, axis=0), np.max(all_hi, axis=0)])
        if max(moving) < .0001:
            raise ValueError('Static animation clip: ' + name)
        if np.max(bounds[1] - bounds[0]) > np.max(new_hi - new_lo) * 4:
            raise ValueError('Exploding skin in ' + name)
        sample_report[name] = {'frames': frames, 'maxVertexMotionMetres': round(max(moving), 5), 'bounds': bounds.tolist()}
        clip_bounds.append(bounds)
        rig.animation_data.action = None
    reset_pose(rig)
    scene.frame_set(1)
    scene.unit_settings.system = 'METRIC'
    scene.render.fps = 24
    for track in tracks.values():
        track.mute = True
    bpy.ops.wm.save_as_mainfile(filepath=str(directory / 'animated.blend'))
    for track in tracks.values():
        track.mute = False
    bpy.ops.object.select_all(action='DESELECT')
    mesh.select_set(True)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    output = directory / 'animated.glb'
    bpy.ops.export_scene.gltf(filepath=str(output), export_format='GLB', use_selection=True,
                             export_animations=True, export_animation_mode='NLA_TRACKS', export_skins=True,
                             export_all_influences=False, export_morph=False)
    for track in tracks.values():
        track.mute = True
    reset_pose(rig)
    scene.frame_set(1)
    bpy.ops.object.camera_add()
    scene.camera = bpy.context.object
    # Eevee's material preview preserves the generated reference texture.
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 12
    scene.cycles.device = 'CPU'
    scene.render.resolution_x = 768
    scene.render.resolution_y = 768
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.film_transparent = False
    if not scene.world:
        scene.world = bpy.data.worlds.new('Review world')
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.16, .19, .24, 1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value = .6
    for position, power, size in [((3, -4, 6), 450, 5), ((-3, -2, 3), 180, 4), ((1, 3, 5), 250, 3)]:
        bpy.ops.object.light_add(type='AREA', location=position)
        light = bpy.context.object
        light.data.energy = power
        light.data.shape = 'DISK'
        light.data.size = size
        light.rotation_euler = (Vector((0, 0, entry['heightMetres'] / 2)) - light.location).to_track_quat('-Z', 'Y').to_euler()
    rest_bounds = np.array([new_lo, new_hi])
    for angle, label in [(0, 'front'), (90, 'side'), (180, 'rear')]:
        render_view(scene, mesh, rest_bounds, directory / (label + '.png'), angle)
    report = {'format': 'rougexr-animated-monster-v1', 'id': identity, 'candidateSha256': candidate_hash,
              'rigSource': str(source.relative_to(ROOT)), 'rigSourceSha256': source_hash,
              'scriptSha256': script_hash, 'sha256': digest(output), 'bytes': output.stat().st_size,
              'bones': len(rig.data.bones), 'clips': CLIPS, 'triangles': len(mesh.data.polygons),
              'heightMetres': entry['heightMetres'], 'hoverMetres': hover,
              'skin': 'four-neighbour surface weight transfer from fitted original species mesh; at most four normalized influences',
              'weightTransferDistance95thPercentileMetres': round(float(np.percentile(distances, 95)), 5),
              'animation': 'Existing authored species motions; ground correction sampled on reconstructed mesh',
              'sampledDeformation': sample_report, 'status': 'structural checks passed; visual review required',
              'seconds': round(time.monotonic() - started, 2),
              'limitations': ['Reference-projected texture; approximate side and back appearance.',
                              'Automatic weight transfer can require manual joint refinement.',
                              'No AI motion generation, facial animation or inferred walking collision.']}
    metadata.write_text(json.dumps(report, indent=2) + '\n')
    print('ANIMATED ' + identity + ' ' + str(report['seconds']) + 's', flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('monsters', nargs='*')
    parser.add_argument('--available', action='store_true')
    parser.add_argument('--all', action='store_true')
    parser.add_argument('--wait-for-meshes', action='store_true')
    parser.add_argument('--rebuild-animation', action='store_true')
    args = parser.parse_args()
    entries = {e['id']: e for e in json.loads((ROOT / 'art/monster-references/hunyuan-v1/prompts.json').read_text())['monsters']}
    identities = args.monsters or (list(entries) if args.all else [identity for identity in entries if (OUTPUT / identity / 'candidate.json').exists()] if args.available else [])
    if not identities:
        parser.error('Choose monster IDs or --available')
    for identity in identities:
        waiting = False
        while not (OUTPUT / identity / 'candidate.json').exists() and args.wait_for_meshes:
            if not waiting: print('WAIT mesh ' + identity, flush=True)
            waiting = True
            time.sleep(5)
        process(identity, entries[identity], args.rebuild_animation)


if __name__ == '__main__':
    main()
