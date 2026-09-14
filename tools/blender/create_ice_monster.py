"""Original crystalline ice monster. Blender 4.5 LTS; no external assets."""
import bpy
import math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'art/blender/creatures/ice-monster.blend'
EXPORT = ROOT / 'public/assets/creatures/ice-monster.glb'
PREVIEW = ROOT / 'art/previews/ice-monster.png'
for path in (SOURCE, EXPORT, PREVIEW):
    path.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.render.fps = 24

def material(name, color, metallic=0.0, roughness=0.45):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    return mat

deep = material('ice_deep_blue', (0.055, 0.24, 0.36), 0.08, 0.28)
ice = material('ice_glacier', (0.28, 0.66, 0.78), 0.05, 0.22)
frost = material('ice_frost', (0.70, 0.91, 0.95), 0.0, 0.35)
white = material('ice_highlights', (0.91, 0.98, 1.0), 0.0, 0.18)
void = material('ice_eye_void', (0.012, 0.045, 0.08), 0.15, 0.2)
glow = material('ice_eye_glow', (0.18, 0.86, 1.0), 0.0, 0.12)
parts = []

def part(name, center, scale, mat, bone, subdivisions=1):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=1, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    obj.vertex_groups.new(name=bone).add(list(range(len(obj.data.vertices))), 1, 'REPLACE')
    parts.append(obj)
    return obj

def crystal(name, base, tip, radius, mat, bone, vertices=5):
    delta = Vector(tip)-Vector(base)
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius, radius2=0,
        depth=delta.length, location=(Vector(base)+Vector(tip))/2)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = delta.to_track_quat('Z', 'Y').to_euler()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    obj.data.materials.append(mat)
    obj.vertex_groups.new(name=bone).add(list(range(len(obj.data.vertices))), 1, 'REPLACE')
    parts.append(obj)
    return obj

# A broad, low elemental silhouette, grounded at Z=0 and facing Blender -Y.
part('core', (0, 0.02, 0.72), (0.32, 0.23, 0.36), deep, 'core', 2)
part('chest_frost', (0, -0.19, 0.76), (0.23, 0.055, 0.26), ice, 'core', 1)
part('head', (0, -0.09, 1.13), (0.25, 0.21, 0.23), ice, 'head', 1)
part('muzzle', (0, -0.27, 1.07), (0.18, 0.10, 0.11), frost, 'head', 1)
part('jaw', (0, -0.28, 0.99), (0.15, 0.075, 0.055), deep, 'jaw', 1)
crystal('crown_center', (0, -0.01, 1.26), (0, 0.01, 1.61), 0.105, frost, 'head')
crystal('crown.L', (0.13, -0.005, 1.24), (0.27, 0.03, 1.49), 0.085, ice, 'head')
crystal('crown.R', (-0.13, -0.005, 1.24), (-0.27, 0.03, 1.49), 0.085, ice, 'head')
for side, sign in [('L', 1), ('R', -1)]:
    part('eye_socket.'+side, (sign*0.105, -0.266, 1.16), (0.066, 0.036, 0.06), void, 'head', 1)
    part('eye.'+side, (sign*0.105, -0.297, 1.16), (0.028, 0.016, 0.026), glow, 'head', 1)
    part('shoulder.'+side, (sign*0.35, 0, 0.82), (0.17, 0.19, 0.20), ice, 'arm.'+side, 1)
    part('forearm.'+side, (sign*0.45, -0.05, 0.51), (0.13, 0.14, 0.25), deep, 'arm.'+side, 1)
    part('fist.'+side, (sign*0.47, -0.15, 0.27), (0.15, 0.16, 0.13), frost, 'arm.'+side, 1)
    for claw in range(3):
        crystal(f'claw.{side}.{claw}', (sign*(0.42+claw*0.04), -0.24, 0.26),
            (sign*(0.42+claw*0.04), -0.34, 0.19), 0.027, white, 'arm.'+side, 5)
    part('thigh.'+side, (sign*0.18, 0.07, 0.38), (0.15, 0.16, 0.23), deep, 'leg.'+side, 1)
    part('foot.'+side, (sign*0.19, -0.09, 0.10), (0.18, 0.25, 0.10), ice, 'leg.'+side, 1)
    crystal('heel_spike.'+side, (sign*0.17, 0.18, 0.16), (sign*0.20, 0.36, 0.22), 0.055, frost, 'leg.'+side)
for i, (x, y, height) in enumerate([(-0.22,0.15,0.36),(0,0.20,0.46),(0.22,0.15,0.34)]):
    crystal(f'back_spike.{i}', (x, y, 0.82), (x, y+0.08, 0.82+height), 0.09, frost, 'core')

bpy.ops.object.select_all(action='DESELECT')
for obj in parts:
    obj.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
mesh = bpy.context.object
mesh.name = 'ice_monster_mesh'
scene.cursor.location = (0, 0, 0)
bpy.ops.object.origin_set(type='ORIGIN_CURSOR')

armature = bpy.data.armatures.new('ice_monster_skeleton')
rig = bpy.data.objects.new('ice_monster_rig', armature)
scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
def bone(name, head, tail, parent=None):
    b = armature.edit_bones.new(name)
    b.head, b.tail = head, tail
    if parent:
        b.parent = armature.edit_bones[parent]
bone('root', (0,0,0), (0,0,0.18))
bone('core', (0,0,0.43), (0,0,0.98), 'root')
bone('head', (0,0,0.98), (0,-0.10,1.34), 'core')
bone('jaw', (0,-0.18,1.04), (0,-0.31,1.01), 'head')
for side, sign in [('L',1),('R',-1)]:
    bone('arm.'+side, (sign*0.28,0,0.87), (sign*0.46,-0.10,0.29), 'core')
    bone('leg.'+side, (sign*0.17,0,0.45), (sign*0.19,-0.08,0.08), 'root')
bpy.ops.object.mode_set(mode='OBJECT')
mesh.modifiers.new('skin', 'ARMATURE').object = rig
mesh.parent = rig
rig.animation_data_create()

def idle(t):
    rig.pose.bones['core'].scale = (1+0.015*math.sin(t*math.tau),)*3
    rig.pose.bones['head'].rotation_euler.y = 0.07*math.sin(t*math.tau)
def move(t):
    for side, sign in [('L',1),('R',-1)]:
        rig.pose.bones['leg.'+side].rotation_euler.x = sign*0.42*math.sin(t*math.tau)
        rig.pose.bones['arm.'+side].rotation_euler.x = -sign*0.22*math.sin(t*math.tau)
    rig.pose.bones['root'].location.z = 0.035*abs(math.sin(t*math.tau))
def attack(t):
    pulse = math.sin(t*math.pi)**2
    rig.pose.bones['core'].rotation_euler.x = -0.18*pulse
    rig.pose.bones['head'].rotation_euler.x = 0.20*pulse
    rig.pose.bones['jaw'].rotation_euler.x = 0.48*pulse
    for side, sign in [('L',1),('R',-1)]:
        rig.pose.bones['arm.'+side].rotation_euler.y = sign*0.82*pulse
    rig.pose.bones['root'].location.y = -0.10*pulse
def hurt(t):
    pulse = math.sin(t*math.pi)*(1-t)
    rig.pose.bones['core'].rotation_euler.z = 0.26*pulse
    rig.pose.bones['head'].rotation_euler.z = -0.20*pulse
def death(t):
    p = min(1, t*1.35)
    rig.pose.bones['root'].rotation_euler.x = -1.32*p
    rig.pose.bones['root'].location.z = 0.17*p
    for side, sign in [('L',1),('R',-1)]:
        rig.pose.bones['arm.'+side].rotation_euler.y = sign*0.55*p

for name, length, pose in [('idle',49,idle),('move',25,move),('attack',25,attack),('hurt',13,hurt),('death',31,death)]:
    action = bpy.data.actions.new(name)
    rig.animation_data.action = action
    for frame in range(1, length+1):
        for b in rig.pose.bones:
            b.rotation_mode = 'XYZ'
            b.rotation_euler = (0,0,0)
            b.location = (0,0,0)
            b.scale = (1,1,1)
        pose((frame-1)/(length-1))
        for b in rig.pose.bones:
            for prop in ('rotation_euler','location','scale'):
                b.keyframe_insert(prop, frame=frame)
    track = rig.animation_data.nla_tracks.new()
    track.name = name
    track.strips.new(name, 1, action)
    track.mute = True
    rig.animation_data.action = None
for b in rig.pose.bones:
    b.rotation_euler=(0,0,0); b.location=(0,0,0); b.scale=(1,1,1)
scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
for track in rig.animation_data.nla_tracks:
    track.mute = False
bpy.ops.object.select_all(action='DESELECT')
mesh.select_set(True); rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.export_scene.gltf(filepath=str(EXPORT), export_format='GLB', use_selection=True,
    export_animations=True, export_animation_mode='NLA_TRACKS', export_skins=True)
for track in rig.animation_data.nla_tracks:
    track.mute = True
for b in rig.pose.bones:
    b.rotation_euler=(0,0,0); b.location=(0,0,0); b.scale=(1,1,1)
scene.frame_set(1)
bpy.ops.object.camera_add(location=(2.35,-3.45,2.15))
camera=bpy.context.object
camera.rotation_euler=(Vector((0,0,0.76))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO'; camera.data.ortho_scale=2.15
scene.camera=camera
scene.render.engine='BLENDER_WORKBENCH'
scene.display.shading.light='STUDIO'; scene.display.shading.color_type='MATERIAL'
scene.display.shading.show_shadows=True; scene.display.shading.show_cavity=True
scene.display.shading.background_type='WORLD'; scene.world.color=(0.035,0.045,0.065)
scene.render.resolution_x=900; scene.render.resolution_y=900; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'; scene.render.filepath=str(PREVIEW)
bpy.ops.render.render(write_still=True)
print('CREATED', SOURCE, EXPORT, PREVIEW)
