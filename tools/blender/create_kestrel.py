"""Original stylized kestrel; Blender 4.5 LTS, no external assets."""
import bpy
import math
from pathlib import Path
from mathutils import Vector, Quaternion

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'art/blender/creatures/kestrel.blend'
EXPORT = ROOT / 'public/assets/creatures/kestrel.glb'
PREVIEW = ROOT / 'art/previews/kestrel.png'
for path in (SOURCE, EXPORT, PREVIEW):
    path.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.render.fps = 24

def material(name, color):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = 0.85
    return mat

rust = material('kestrel_russet', (0.45, 0.20, 0.07))
cream = material('kestrel_buff', (0.77, 0.63, 0.39))
slate = material('kestrel_slate', (0.30, 0.36, 0.39))
dark = material('kestrel_charcoal', (0.035, 0.025, 0.021))
gold = material('kestrel_cere_talons', (0.90, 0.53, 0.06))
ivory = material('kestrel_eye_glint', (0.95, 0.89, 0.71))
parts = []

def bind(obj, name, mat, bone):
    obj.name = name
    obj.data.materials.append(mat)
    obj.vertex_groups.new(name=bone).add(list(range(len(obj.data.vertices))), 1, 'REPLACE')
    parts.append(obj)
    return obj

def ellipsoid(name, center, scale, mat, bone):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1, location=center)
    obj = bpy.context.object
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return bind(obj, name, mat, bone)

def feather(name, start, end, width, mat, bone):
    """Solid tapered feather with a raised central ridge; no alpha cards."""
    a, b = Vector(start), Vector(end)
    direction = (b - a).normalized()
    side = direction.cross(Vector((0, 0, 1))).normalized() * width
    mid = a.lerp(b, 0.45)
    verts = [a, mid + side, b, mid - side, mid + Vector((0, 0, 0.018)), mid - Vector((0, 0, 0.012))]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], [(0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4),
                                (1, 0, 5), (2, 1, 5), (3, 2, 5), (0, 3, 5)])
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    return bind(obj, name, mat, bone)

def cone(name, start, end, radius, mat, bone):
    delta = Vector(end) - Vector(start)
    bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=radius, radius2=0,
        depth=delta.length, location=(Vector(start) + Vector(end)) / 2)
    obj = bpy.context.object
    obj.rotation_euler = delta.to_track_quat('Z', 'Y').to_euler()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return bind(obj, name, mat, bone)

# Flying rest pose: Blender -Y forward / glTF +Z forward. One-meter wingspan.
ellipsoid('body', (0, 0.025, 0.80), (0.12, 0.23, 0.13), rust, 'body')
ellipsoid('breast', (0, -0.065, 0.755), (0.105, 0.17, 0.105), cream, 'body')
ellipsoid('head', (0, -0.215, 0.90), (0.105, 0.11, 0.11), slate, 'head')
ellipsoid('face', (0, -0.272, 0.865), (0.079, 0.065, 0.065), cream, 'head')
ellipsoid('cere', (0, -0.322, 0.885), (0.043, 0.04, 0.03), gold, 'head')
cone('beak_top', (0, -0.34, 0.89), (0, -0.405, 0.876), 0.028, dark, 'head')
cone('beak_hook', (0, -0.386, 0.882), (0, -0.389, 0.844), 0.017, dark, 'head')
for side, s in [('L', 1), ('R', -1)]:
    ellipsoid('eye_ring.' + side, (s * 0.085, -0.267, 0.923), (0.024, 0.029, 0.028), gold, 'head')
    ellipsoid('eye.' + side, (s * 0.101, -0.275, 0.925), (0.013, 0.021, 0.022), dark, 'head')
    ellipsoid('glint.' + side, (s * 0.108, -0.288, 0.936), (0.004, 0.006, 0.005), ivory, 'head')
    ellipsoid('moustache.' + side, (s * 0.073, -0.269, 0.872), (0.012, 0.018, 0.039), dark, 'head')
    ellipsoid('shoulder.' + side, (s * 0.16, 0.015, 0.83), (0.12, 0.13, 0.035), rust, 'wing.' + side)
    ellipsoid('wing_coverts.' + side, (s * 0.29, 0.02, 0.835), (0.14, 0.10, 0.026), rust, 'wing.' + side)
    for i in range(6):
        x = 0.13 + i * 0.037
        feather(f'secondary.{side}.{i}', (s*x, -0.02, 0.834), (s*(x+0.03), 0.20-i*0.008, 0.81), 0.026, cream if i%3==0 else rust, 'wing.' + side)
    for i in range(7):
        feather(f'primary.{side}.{i}', (s*(0.31+i*0.012), -0.035+i*0.017, 0.84),
            (s*(0.57-i*0.018), -0.035+i*0.045, 0.81), 0.022, dark if i%2==0 else slate, 'tip.' + side)
    for i in range(5):
        ellipsoid(f'wing_spot.{side}.{i}', (s*(0.14+i*0.043), 0.026+(i%2)*0.018, 0.864), (0.009, 0.019, 0.004), dark, 'wing.' + side)
    ellipsoid('leg.' + side, (s*0.058, 0.065, 0.665), (0.023, 0.025, 0.072), gold, 'leg.' + side)
    for toe in range(3):
        start = (s*0.058, 0.055, 0.61)
        end = (s*0.058+(toe-1)*0.025, -0.019, 0.59)
        cone(f'toe.{side}.{toe}', start, end, 0.008, gold, 'leg.' + side)
        cone(f'talon.{side}.{toe}', end, (end[0], end[1]-0.014, end[2]-0.012), 0.006, dark, 'leg.' + side)
for i in range(7):
    x = (i-3)*0.018
    feather(f'tail.{i}', (x, 0.16, 0.80), (x*2.1, 0.48, 0.77), 0.021, slate if i%2==0 else rust, 'tail')
    feather(f'tail_band.{i}', (x*1.85, 0.41, 0.786), (x*2.0, 0.45, 0.782), 0.02, dark, 'tail')
for row in range(3):
    for col in range(3):
        ellipsoid(f'breast_spot.{row}.{col}', ((col-1)*0.043, -0.10+row*0.055, 0.656), (0.007, 0.017, 0.004), dark, 'body')

bpy.ops.object.select_all(action='DESELECT')
for obj in parts:
    obj.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
mesh = bpy.context.object
mesh.name = 'kestrel_mesh'
# Place mesh origin at world zero to keep an unambiguous glTF root transform.
scene.cursor.location = (0, 0, 0)
bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
armature = bpy.data.armatures.new('kestrel_skeleton')
rig = bpy.data.objects.new('kestrel_rig', armature)
scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
def bone(name, head, tail, parent=None):
    b = armature.edit_bones.new(name)
    b.head, b.tail = head, tail
    if parent:
        b.parent = armature.edit_bones[parent]
bone('root', (0, 0, 0), (0, 0, 0.15))
bone('body', (0, 0, 0.80), (0, -0.14, 0.80), 'root')
bone('head', (0, -0.18, 0.86), (0, -0.30, 0.90), 'body')
bone('tail', (0, 0.16, 0.80), (0, 0.43, 0.78), 'body')
for side, s in [('L', 1), ('R', -1)]:
    bone('wing.'+side, (s*0.09, 0, 0.83), (s*0.32, 0, 0.83), 'body')
    bone('tip.'+side, (s*0.32, 0, 0.83), (s*0.53, 0.02, 0.83), 'wing.'+side)
    bone('leg.'+side, (s*0.058, 0.07, 0.72), (s*0.058, 0.04, 0.61), 'body')
bpy.ops.object.mode_set(mode='OBJECT')
mesh.modifiers.new('skin', 'ARMATURE').object = rig
mesh.parent = rig
rig.animation_data_create()

def rotate(name, axis, angle):
    basis = rig.data.bones[name].matrix_local.to_quaternion()
    rig.pose.bones[name].rotation_quaternion = basis.inverted() @ Quaternion(axis, angle) @ basis

def flap(t, amplitude):
    for side, s in [('L', 1), ('R', -1)]:
        rotate('wing.'+side, (0, 1, 0), s*math.sin(t*math.tau)*amplitude)
        rotate('tip.'+side, (0, 1, 0), s*math.sin(t*math.tau-0.35)*amplitude*0.35)

def idle(t):
    flap(t, 0.18)
    rotate('head', (0, 0, 1), math.sin(t*math.tau)*0.16)
    rig.pose.bones['root'].location.y = math.sin(t*math.tau)*0.015
def move(t):
    flap(t, 0.85)
    rotate('tail', (1, 0, 0), math.sin(t*math.tau)*0.09)
    rig.pose.bones['root'].location.y = math.sin(t*math.tau)*0.025
def attack(t):
    pulse = math.sin(math.pi*t)**2
    flap(t, 0.45)
    rotate('body', (1, 0, 0), -0.50*pulse)
    rotate('head', (1, 0, 0), -0.30*pulse)
    for side in ['L', 'R']:
        rotate('leg.'+side, (1, 0, 0), -0.7*pulse)
def hurt(t):
    rotate('body', (0, 1, 0), math.sin(t*math.tau)*0.25*(1-t))
    flap(t, 0.35)
def death(t):
    p = min(1, t*1.4)
    rotate('body', (0, 1, 0), p*1.35)
    for side, s in [('L', 1), ('R', -1)]:
        rotate('wing.'+side, (0, 1, 0), -s*0.6*p)
    # Root bone local Y points up in Blender.
    rig.pose.bones['root'].location.y = -0.56*p

for name, length, pose in [('idle', 49, idle), ('move', 25, move), ('attack', 19, attack), ('hurt', 13, hurt), ('death', 31, death)]:
    action = bpy.data.actions.new(name)
    rig.animation_data.action = action
    for frame in range(1, length+1):
        for b in rig.pose.bones:
            b.rotation_mode = 'QUATERNION'
            b.rotation_quaternion = (1, 0, 0, 0)
            b.location = (0, 0, 0)
        pose((frame-1)/(length-1))
        for b in rig.pose.bones:
            b.keyframe_insert('rotation_quaternion', frame=frame)
            b.keyframe_insert('location', frame=frame)
    track = rig.animation_data.nla_tracks.new()
    track.name = name
    track.strips.new(name, 1, action)
    track.mute = True
    rig.animation_data.action = None
for b in rig.pose.bones:
    b.rotation_quaternion = (1, 0, 0, 0)
    b.location = (0, 0, 0)
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
for b in rig.pose.bones:
    b.rotation_quaternion = (1, 0, 0, 0)
    b.location = (0, 0, 0)
scene.frame_set(1)
bpy.ops.object.camera_add(location=(1.5, -2.7, 2.6))
camera = bpy.context.object
camera.rotation_euler = (Vector((0, 0.04, 0.8))-camera.location).to_track_quat('-Z', 'Y').to_euler()
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 1.45
scene.camera = camera
scene.render.engine = 'BLENDER_WORKBENCH'
scene.display.shading.light = 'STUDIO'
scene.display.shading.color_type = 'MATERIAL'
scene.display.shading.show_shadows = True
scene.display.shading.show_cavity = True
scene.display.shading.background_type = 'WORLD'
scene.world.color = (0.035, 0.045, 0.065)
scene.render.resolution_x = 1000
scene.render.resolution_y = 800
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = str(PREVIEW)
bpy.ops.render.render(write_still=True)
print('CREATED', SOURCE, EXPORT, PREVIEW)
