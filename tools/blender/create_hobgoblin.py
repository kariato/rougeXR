"""Run with Blender 4.5 LTS: blender --background --python tools/blender/create_hobgoblin.py."""
import bpy
import math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'art/blender/creatures/hobgoblin.blend'
EXPORT = ROOT / 'public/assets/creatures/hobgoblin.glb'
PREVIEW = ROOT / 'art/previews/hobgoblin.png'
for path in (SOURCE, EXPORT, PREVIEW):
    path.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.render.fps = 24

def material(name, color, metallic=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = 0.8
    bsdf.inputs['Metallic'].default_value = metallic
    return mat

skin = material('skin_moss', (0.24, 0.39, 0.15))
leather = material('leather_oxblood', (0.22, 0.065, 0.035))
boots = material('boots_charcoal', (0.065, 0.05, 0.04))
steel = material('iron', (0.28, 0.32, 0.34), 0.65)
ivory = material('ivory', (0.83, 0.75, 0.52))
eyes = material('eyes_amber', (1.0, 0.51, 0.055))
wood = material('club_wood', (0.27, 0.14, 0.055))
parts = []

def part(name, center, scale, mat, bone, shape='ico'):
    if shape == 'cube':
        bpy.ops.mesh.primitive_cube_add(size=2, location=center)
    else:
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    group = obj.vertex_groups.new(name=bone)
    group.add(list(range(len(obj.data.vertices))), 1.0, 'REPLACE')
    parts.append(obj)
    return obj

def cone(name, base, tip, radius, mat, bone):
    delta = Vector(tip) - Vector(base)
    bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=radius, radius2=0, depth=delta.length,
        location=(Vector(base) + Vector(tip)) / 2)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = delta.to_track_quat('Z', 'Y').to_euler()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    obj.data.materials.append(mat)
    obj.vertex_groups.new(name=bone).add(list(range(len(obj.data.vertices))), 1, 'REPLACE')
    parts.append(obj)

# Model faces Blender -Y, which exports to glTF +Z. Grounded, roughly 1.45 m tall.
part('tunic', (0, 0, 0.82), (0.25, 0.16, 0.30), leather, 'spine')
part('belt', (0, -0.005, 0.66), (0.255, 0.17, 0.045), boots, 'spine', 'cube')
part('buckle', (0, -0.184, 0.66), (0.045, 0.018, 0.035), steel, 'spine', 'cube')
part('head', (0, -0.012, 1.20), (0.245, 0.19, 0.245), skin, 'head')
part('jaw', (0, -0.13, 1.10), (0.19, 0.12, 0.115), skin, 'head')
part('nose', (0, -0.235, 1.22), (0.068, 0.073, 0.065), skin, 'head')
part('mouth', (0, -0.237, 1.09), (0.13, 0.013, 0.021), boots, 'head', 'cube')
for side, sign in [('L', 1), ('R', -1)]:
    cone('ear_' + side, (sign * 0.19, 0, 1.23), (sign * 0.39, 0.025, 1.36), 0.09, skin, 'head')
    part('eye_' + side, (sign * 0.092, -0.189, 1.255), (0.041, 0.022, 0.03), eyes, 'head')
    part('pupil_' + side, (sign * 0.092, -0.212, 1.255), (0.012, 0.008, 0.021), boots, 'head')
    brow = part('brow_' + side, (sign * 0.095, -0.194, 1.297), (0.078, 0.025, 0.025), skin, 'head', 'cube')
    brow.rotation_euler.y = sign * -0.2
    cone('tusk_' + side, (sign * 0.09, -0.24, 1.065), (sign * 0.10, -0.245, 1.14), 0.023, ivory, 'head')
    part('arm_' + side, (sign * 0.32, 0, 0.87), (0.10, 0.105, 0.23), skin, 'arm.' + side)
    part('hand_' + side, (sign * 0.34, -0.015, 0.64), (0.10, 0.095, 0.105), skin, 'arm.' + side)
    part('leg_' + side, (sign * 0.13, 0, 0.38), (0.105, 0.11, 0.23), leather, 'leg.' + side)
    part('boot_' + side, (sign * 0.13, -0.065, 0.11), (0.115, 0.18, 0.11), boots, 'leg.' + side, 'cube')
part('pauldron', (-0.28, 0, 1.025), (0.155, 0.15, 0.09), steel, 'arm.R')
part('club_handle', (0.34, -0.055, 0.53), (0.04, 0.04, 0.23), wood, 'arm.L')
part('club_head', (0.34, -0.055, 0.30), (0.095, 0.095, 0.15), wood, 'arm.L')
part('club_band', (0.34, -0.055, 0.31), (0.10, 0.10, 0.028), steel, 'arm.L', 'cube')

bpy.ops.object.select_all(action='DESELECT')
for obj in parts:
    obj.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
mesh = bpy.context.object
mesh.name = 'hobgoblin_mesh'
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

armature = bpy.data.armatures.new('hobgoblin_skeleton')
rig = bpy.data.objects.new('hobgoblin_rig', armature)
scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
def bone(name, head, tail, parent=None):
    b = armature.edit_bones.new(name)
    b.head, b.tail = head, tail
    if parent:
        b.parent = armature.edit_bones[parent]
bone('root', (0, 0, 0), (0, 0, 0.2))
bone('spine', (0, 0, 0.65), (0, 0, 1.05), 'root')
bone('head', (0, 0, 1.05), (0, 0, 1.43), 'spine')
for side, sign in [('L', 1), ('R', -1)]:
    bone('arm.' + side, (sign * 0.29, 0, 1.04), (sign * 0.34, 0, 0.63), 'spine')
    bone('leg.' + side, (sign * 0.13, 0, 0.62), (sign * 0.13, 0, 0.10), 'root')
bpy.ops.object.mode_set(mode='OBJECT')
modifier = mesh.modifiers.new('skin', 'ARMATURE')
modifier.object = rig
mesh.parent = rig
rig.animation_data_create()

def clip(name, length, pose):
    action = bpy.data.actions.new(name)
    rig.animation_data.action = action
    for frame in range(1, length + 1, 3):
        keypose(frame, length, pose)
    keypose(length, length, pose)
    track = rig.animation_data.nla_tracks.new()
    track.name = name
    track.strips.new(name, 1, action)
    rig.animation_data.action = None

def keypose(frame, length, pose):
    t = (frame - 1) / (length - 1)
    for b in rig.pose.bones:
        b.rotation_mode = 'XYZ'
        b.rotation_euler = (0, 0, 0)
        b.location = (0, 0, 0)
    pose(t)
    for b in rig.pose.bones:
        b.keyframe_insert('rotation_euler', frame=frame)
        b.keyframe_insert('location', frame=frame)

def idle(t):
    rig.pose.bones['spine'].scale = (1, 1, 1)
    rig.pose.bones['head'].rotation_euler.y = math.sin(t * math.tau) * 0.06
    rig.pose.bones['root'].location.z = math.sin(t * math.tau) * 0.012
def move(t):
    for side, sign in [('L', 1), ('R', -1)]:
        rig.pose.bones['leg.' + side].rotation_euler.x = sign * math.sin(t * math.tau) * 0.48
        rig.pose.bones['arm.' + side].rotation_euler.x = -sign * math.sin(t * math.tau) * 0.3
    rig.pose.bones['root'].location.z = abs(math.sin(t * math.tau)) * 0.045
def attack(t):
    swing = math.sin(t * math.pi)
    rig.pose.bones['arm.L'].rotation_euler.x = -2.1 * swing
    rig.pose.bones['spine'].rotation_euler.z = 0.28 * swing
def hurt(t):
    rig.pose.bones['spine'].rotation_euler.x = -0.3 * math.sin(t * math.pi)
    rig.pose.bones['head'].rotation_euler.x = 0.2 * math.sin(t * math.pi)
def death(t):
    rig.pose.bones['root'].rotation_euler.x = -math.pi / 2 * min(1, t * 1.4)
    rig.pose.bones['root'].location.z = 0.20 * min(1, t * 1.4)
for name, length, pose in [('idle', 49, idle), ('move', 25, move), ('attack', 19, attack), ('hurt', 13, hurt), ('death', 31, death)]:
    clip(name, length, pose)
for b in rig.pose.bones:
    b.rotation_euler = (0, 0, 0)
    b.location = (0, 0, 0)
for track in rig.animation_data.nla_tracks:
    track.mute = True
scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
for track in rig.animation_data.nla_tracks:
    track.mute = False
bpy.ops.object.select_all(action='DESELECT')
mesh.select_set(True)
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.export_scene.gltf(filepath=str(EXPORT), export_format='GLB', use_selection=True,
    export_animations=True, export_animation_mode='NLA_TRACKS', export_skins=True)
for track in rig.animation_data.nla_tracks:
    track.mute = True
scene.frame_set(1)

# Preview helpers are deliberately added after asset export.
bpy.ops.object.camera_add(location=(2.4, -3.5, 2.1))
camera = bpy.context.object
camera.rotation_euler = (Vector((0, 0, 0.72)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 2.05
scene.camera = camera
scene.render.engine = 'BLENDER_WORKBENCH'
scene.display.shading.light = 'STUDIO'
scene.display.shading.color_type = 'MATERIAL'
scene.display.shading.show_shadows = True
scene.display.shading.show_cavity = True
scene.display.shading.background_type = 'WORLD'
scene.world.color = (0.035, 0.045, 0.065)
scene.render.resolution_x = 900
scene.render.resolution_y = 900
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = str(PREVIEW)
bpy.ops.render.render(write_still=True)
print('CREATED', SOURCE, EXPORT, PREVIEW)
