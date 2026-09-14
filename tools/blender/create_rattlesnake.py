"""Original rattlesnake asset. Run with Blender 4.5 LTS in background mode."""
import bpy
import math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'art/blender/creatures/rattlesnake.blend'
EXPORT = ROOT / 'public/assets/creatures/rattlesnake.glb'
PREVIEW = ROOT / 'art/previews/rattlesnake.png'
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
    bsdf.inputs['Roughness'].default_value = 0.78
    return mat

sand = material('snake_sand', (0.42, 0.30, 0.12))
diamond = material('snake_diamonds', (0.105, 0.075, 0.035))
belly = material('snake_belly', (0.72, 0.60, 0.36))
horn = material('snake_rattle', (0.65, 0.46, 0.20))
black = material('snake_pupil', (0.012, 0.009, 0.006))
amber = material('snake_iris', (0.95, 0.51, 0.025))
ivory = material('snake_fangs', (0.90, 0.84, 0.66))
red = material('snake_tongue', (0.35, 0.035, 0.025))
parts = []

def ellipsoid(name, center, scale, mat, bone):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    obj.vertex_groups.new(name=bone).add(list(range(len(obj.data.vertices))), 1, 'REPLACE')
    parts.append(obj)
    return obj

def cone(name, start, end, radius, mat, bone):
    delta = Vector(end)-Vector(start)
    bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=radius, radius2=0, depth=delta.length, location=(Vector(start)+Vector(end))/2)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = delta.to_track_quat('Z', 'Y').to_euler()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    obj.data.materials.append(mat)
    obj.vertex_groups.new(name=bone).add(list(range(len(obj.data.vertices))), 1, 'REPLACE')
    parts.append(obj)

# Continuous tube, weighted between 13 control bones. Head faces Blender -Y.
def path(t):
    return Vector((0.23*math.sin(t*math.tau*1.2)*math.sin(t*math.pi), -0.28+1.05*t,
        0.09+0.24*math.exp(-t*9)+0.09*t**8))

verts, faces, material_ids = [], [], []
rings, sides = 65, 12
for i in range(rings):
    t = i/(rings-1)
    center = path(t)
    tangent = (path(min(1, t+0.001))-path(max(0, t-0.001))).normalized()
    across = tangent.cross(Vector((0, 0, 1))).normalized()
    up = across.cross(tangent).normalized()
    radius = 0.066*(1-0.76*t**2)
    for j in range(sides):
        angle = j*math.tau/sides
        verts.append(center + across*math.cos(angle)*radius + up*math.sin(angle)*radius)
        if i < rings-1:
            faces.append((i*sides+j, i*sides+(j+1)%sides, (i+1)*sides+(j+1)%sides, (i+1)*sides+j))
            # Repeated dark diamonds taper across the dorsal surface.
            dorsal = math.sin(angle+math.pi/sides)
            stripe = abs((i%8)-4)
            material_ids.append(2 if dorsal < -0.3 else 1 if stripe < 1+2*dorsal else 0)
faces.extend([tuple(reversed(range(sides))), tuple((rings-1)*sides+j for j in range(sides))])
material_ids.extend([0, 0])
data = bpy.data.meshes.new('snake_body_geometry')
data.from_pydata(verts, [], [tuple(reversed(face)) for face in faces])
data.update()
body = bpy.data.objects.new('snake_body', data)
scene.collection.objects.link(body)
for mat in (sand, diamond, belly):
    data.materials.append(mat)
for polygon, mat_id in zip(data.polygons, material_ids):
    polygon.material_index = mat_id
groups = [body.vertex_groups.new(name=f'body.{i:02}') for i in range(13)]
for i in range(rings):
    value = i/(rings-1)*12
    low = int(value)
    frac = value-low
    indices = list(range(i*sides, (i+1)*sides))
    groups[low].add(indices, 1-frac, 'REPLACE')
    if low < 12 and frac:
        groups[low+1].add(indices, frac, 'REPLACE')
parts.append(body)
ellipsoid('triangular_head', (0, -0.36, 0.35), (0.105, 0.13, 0.058), sand, 'head')
ellipsoid('snout', (0, -0.455, 0.343), (0.065, 0.065, 0.044), sand, 'head')
ellipsoid('lower_jaw', (0, -0.409, 0.303), (0.073, 0.098, 0.023), belly, 'jaw')
for side, s in [('L', 1), ('R', -1)]:
    ellipsoid('eye.'+side, (s*0.078, -0.403, 0.374), (0.021, 0.023, 0.015), amber, 'head')
    ellipsoid('pupil.'+side, (s*0.087, -0.41, 0.381), (0.006, 0.012, 0.007), black, 'head')
    ellipsoid('nostril.'+side, (s*0.035, -0.505, 0.35), (0.007, 0.004, 0.005), black, 'head')
    cone('fang.'+side, (s*0.042, -0.451, 0.324), (s*0.034, -0.465, 0.279), 0.009, ivory, 'head')
cone('tongue', (0, -0.445, 0.31), (0, -0.55, 0.302), 0.009, red, 'tongue')
for s in [-1, 1]:
    cone('tongue_fork', (0, -0.54, 0.303), (s*0.018, -0.574, 0.302), 0.004, red, 'tongue')
for i in range(6):
    ellipsoid(f'rattle.{i}', (0, 0.78+i*0.023, 0.184+i*0.012), (0.029-i*0.002, 0.019, 0.026-i*0.002), horn if i%2==0 else belly, 'rattle')

bpy.ops.object.select_all(action='DESELECT')
for obj in parts:
    obj.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.object.join()
mesh = bpy.context.object
mesh.name = 'rattlesnake_mesh'
scene.cursor.location = (0, 0, 0)
bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
armature = bpy.data.armatures.new('rattlesnake_skeleton')
rig = bpy.data.objects.new('rattlesnake_rig', armature)
scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
def bone(name, head, parent):
    b = armature.edit_bones.new(name)
    b.head = head
    b.tail = Vector(head)+Vector((0, 0, 0.05))
    if parent:
        b.parent = armature.edit_bones[parent]
bone('root', (0, 0, 0), None)
for i in range(13):
    bone(f'body.{i:02}', path(i/12), 'root')
bone('head', (0, -0.28, 0.33), 'body.00')
bone('jaw', (0, -0.33, 0.31), 'head')
bone('tongue', (0, -0.445, 0.31), 'head')
bone('rattle', (0, 0.77, 0.18), 'body.12')
bpy.ops.object.mode_set(mode='OBJECT')
mesh.modifiers.new('skin', 'ARMATURE').object = rig
mesh.parent = rig
rig.animation_data_create()

def wave(t, amplitude):
    for i in range(13):
        rig.pose.bones[f'body.{i:02}'].location.x = amplitude*math.sin(t*math.tau-i*0.6)
def idle(t):
    wave(t, 0.005)
    rig.pose.bones['rattle'].rotation_euler.y = math.sin(t*math.tau*8)*0.18
    rig.pose.bones['tongue'].scale.y = 0.5+0.5*math.cos(t*math.tau)
def move(t):
    wave(t, 0.055)
    rig.pose.bones['head'].rotation_euler.y = math.sin(t*math.tau)*0.1
def attack(t):
    pulse = math.sin(t*math.pi)**2
    for i in range(6):
        rig.pose.bones[f'body.{i:02}'].location.z = 0.14*pulse*(1-i/6)
    rig.pose.bones['head'].rotation_euler.x = -0.18*pulse
    rig.pose.bones['jaw'].rotation_euler.x = 0.55*pulse
def hurt(t):
    wave(t, 0.025*math.sin(t*math.pi))
    rig.pose.bones['head'].rotation_euler.y = math.sin(t*math.tau)*0.25*(1-t)
def death(t):
    p = min(1, t*1.3)
    for i in range(13):
        rig.pose.bones[f'body.{i:02}'].location.y = -(path(i/12).z-0.075)*p
    rig.pose.bones['head'].rotation_euler.z = 1.05*p
    rig.pose.bones['jaw'].rotation_euler.x = 0.18*p

for name, length, pose in [('idle', 49, idle), ('move', 33, move), ('attack', 19, attack), ('hurt', 13, hurt), ('death', 31, death)]:
    action = bpy.data.actions.new(name)
    rig.animation_data.action = action
    for frame in range(1, length+1):
        for b in rig.pose.bones:
            b.rotation_mode = 'XYZ'
            b.rotation_euler = (0, 0, 0)
            b.location = (0, 0, 0)
            b.scale = (1, 1, 1)
        pose((frame-1)/(length-1))
        for b in rig.pose.bones:
            for prop in ('rotation_euler', 'location', 'scale'):
                b.keyframe_insert(prop, frame=frame)
    track = rig.animation_data.nla_tracks.new()
    track.name = name
    track.strips.new(name, 1, action)
    track.mute = True
    rig.animation_data.action = None
for b in rig.pose.bones:
    b.rotation_euler = (0, 0, 0)
    b.location = (0, 0, 0)
    b.scale = (1, 1, 1)
scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
for track in rig.animation_data.nla_tracks:
    track.mute = False
bpy.ops.object.select_all(action='DESELECT')
mesh.select_set(True)
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.export_scene.gltf(filepath=str(EXPORT), export_format='GLB', use_selection=True, export_animations=True, export_animation_mode='NLA_TRACKS', export_skins=True)
for track in rig.animation_data.nla_tracks:
    track.mute = True
for b in rig.pose.bones:
    b.rotation_euler = (0, 0, 0)
    b.location = (0, 0, 0)
    b.scale = (1, 1, 1)
scene.frame_set(1)
bpy.ops.object.camera_add(location=(1.25, -1.9, 1.6))
camera = bpy.context.object
camera.rotation_euler = (Vector((0, 0.12, 0.18))-camera.location).to_track_quat('-Z', 'Y').to_euler()
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 1.65
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
