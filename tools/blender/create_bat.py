"""Original stylized bat with solid membrane wings; Blender 4.5 LTS, no external assets."""
import bpy
import math
from pathlib import Path
from mathutils import Vector, Quaternion

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'art/blender/creatures/bat.blend'
EXPORT = ROOT / 'public/assets/creatures/bat.glb'
PREVIEW = ROOT / 'art/previews/bat.png'
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


fur = material('bat_umber_fur', (0.16, 0.075, 0.045))
chest = material('bat_warm_chest', (0.32, 0.19, 0.12))
membrane = material('bat_wing_membrane', (0.24, 0.085, 0.075))
finger = material('bat_wing_fingers', (0.11, 0.045, 0.035))
inner = material('bat_inner_ear', (0.47, 0.22, 0.18))
dark = material('bat_nose_eyes', (0.014, 0.009, 0.008))
amber = material('bat_eye_amber', (0.8, 0.34, 0.045))
ivory = material('bat_fangs_claws', (0.82, 0.73, 0.54))
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

def cone(name, start, end, radius, mat, bone):
    delta = Vector(end) - Vector(start)
    bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=radius, radius2=0,
        depth=delta.length, location=(Vector(start) + Vector(end)) / 2)
    obj = bpy.context.object
    obj.rotation_euler = delta.to_track_quat('Z', 'Y').to_euler()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return bind(obj, name, mat, bone)


def panel(name, points, bone):
    # Closed thin prism, triangulated and normals recalculated before export.
    n = len(points)
    vertices = [(x,y,z+d) for d in (-0.004,0.004) for x,y,z in points]
    faces = [tuple(range(n-1,-1,-1)), tuple(range(n,2*n))]
    faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    bind(obj,name,membrane,bone)
    if bone.startswith('wing.'):
        # Both sides of the membrane seam follow the same finger control.
        seam = [v.index for v in data.vertices if abs(v.co.x) >= 0.299]
        obj.vertex_groups[bone].remove(seam)
        obj.vertex_groups.new(name=bone.replace('wing.', 'tip.')).add(seam, 1, 'REPLACE')
    return obj

ellipsoid('body',(0,0.015,0.80),(0.115,0.17,0.125),fur,'body')
ellipsoid('chest',(0,-0.055,0.745),(0.089,0.105,0.07),chest,'body')
ellipsoid('head',(0,-0.175,0.90),(0.105,0.092,0.095),fur,'head')
ellipsoid('muzzle',(0,-0.252,0.875),(0.063,0.038,0.04),chest,'head')
ellipsoid('nose',(0,-0.284,0.898),(0.031,0.018,0.02),dark,'head')
ellipsoid('mouth',(0,-0.278,0.851),(0.042,0.01,0.014),dark,'head')
for side, sign in [('L',1),('R',-1)]:
    ellipsoid('ear.'+side,(sign*0.072,-0.145,1.025),(0.043,0.034,0.115),fur,'head')
    ellipsoid('inner_ear.'+side,(sign*0.072,-0.173,1.03),(0.028,0.009,0.082),inner,'head')
    ellipsoid('eye.'+side,(sign*0.075,-0.245,0.922),(0.019,0.014,0.021),amber,'head')
    ellipsoid('pupil.'+side,(sign*0.075,-0.257,0.922),(0.009,0.006,0.014),dark,'head')
    cone('fang.'+side,(sign*0.025,-0.284,0.86),(sign*0.024,-0.287,0.827),0.009,ivory,'head')
    def pt(x,y,z=0.83): return (sign*x,y,z)
    shoulder=pt(0.09,0)
    wrist=pt(0.32,-0.04)
    tip=pt(0.69,0.005)
    # Scalloped trailing edge between long finger tips.
    outline=[shoulder,wrist,tip,pt(0.53,0.09),pt(0.50,0.24),
             pt(0.38,0.16),pt(0.30,0.32),pt(0.22,0.19),pt(0.10,0.20)]
    panel('inner_membrane.'+side,[outline[0],outline[1],pt(0.30,0.32),outline[7],outline[8]],'wing.'+side)
    panel('outer_membrane.'+side,[outline[1],*outline[2:7]],'tip.'+side)
    cone('upper_arm.'+side,shoulder,wrist,0.027,fur,'wing.'+side)
    for j,end in enumerate([tip,pt(0.50,0.24),pt(0.30,0.32)]):
        cone('finger.'+side+str(j),wrist,end,0.012,finger,'tip.'+side)
    cone('thumb.'+side,wrist,pt(0.34,-0.12,0.86),0.015,fur,'tip.'+side)
    cone('thumb_claw.'+side,pt(0.34,-0.12,0.86),pt(0.36,-0.13,0.84),0.007,ivory,'tip.'+side)
    ellipsoid('leg.'+side,(sign*0.065,0.125,0.69),(0.025,0.027,0.07),fur,'leg.'+side)
    for j in range(3):
        cone('claw.'+side+str(j),(sign*0.065+(j-1)*0.015,0.11,0.64),
             (sign*0.065+(j-1)*0.017,0.08,0.615),0.007,ivory,'leg.'+side)
panel('tail_membrane',[(-0.075,0.12,0.77),(0,0.31,0.76),(0.075,0.12,0.77)],'tail')
cone('tail',(0,0.13,0.78),(0,0.31,0.76),0.014,fur,'tail')

bpy.ops.object.select_all(action='DESELECT')
for obj in parts:
    obj.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
mesh = bpy.context.object
mesh.name = 'bat_mesh'
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.normals_make_consistent(inside=False)
bpy.ops.object.mode_set(mode='OBJECT')
# Place mesh origin at world zero to keep an unambiguous glTF root transform.
scene.cursor.location = (0, 0, 0)
bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
armature = bpy.data.armatures.new('bat_skeleton')
rig = bpy.data.objects.new('bat_rig', armature)
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
bone('tail', (0, 0.16, 0.80), (0, 0.32, 0.76), 'body')
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
    rig.pose.bones['root'].location.z = 0.14*pulse
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
camera.data.ortho_scale = 1.75
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
