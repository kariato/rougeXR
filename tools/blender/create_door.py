"""Create a room-facing hinged doorway with an `open` GLB clip.

Run: blender --background --python tools/blender/create_door.py
Local Blender -Y (GLB/Three +Z) points into the room. The hinge is at local -X.
"""
import math
from pathlib import Path

import bpy
from mathutils import Vector

root = Path(__file__).resolve().parents[2]
source = root / 'art/blender/props/door.blend'
export = root / 'public/assets/props/door.glb'
preview = root / 'art/previews/door.png'
for path in (source, export, preview):
    path.parent.mkdir(parents=True, exist_ok=True)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.render.fps = 24

def material(name, color, metallic=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    principled = mat.node_tree.nodes['Principled BSDF']
    principled.inputs['Base Color'].default_value = (*color, 1)
    principled.inputs['Metallic'].default_value = metallic
    principled.inputs['Roughness'].default_value = 0.5 if metallic else 0.88
    return mat

stone = material('doorway_worn_stone', (.48, .43, .35))
edge = material('stone_edge', (.60, .53, .42))
wood = material('door_oak', (.39, .21, .10))
wood_edge = material('door_oak_highlight', (.49, .29, .14))
iron = material('door_forged_iron', (.17, .19, .20), .7)

def cube(name, location, dimensions, mat, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

# Thin jambs and lintel frame the passable tile; the swing leaf is narrower than a tile.
cube('left_stone_jamb', (-.44, 0, .84), (.12, .18, 1.68), stone)
cube('right_stone_jamb', (.44, 0, .84), (.12, .18, 1.68), stone)
cube('stone_lintel', (0, 0, 1.66), (1.00, .20, .16), stone)
for x in (-.44, .44):
    cube('jamb_edge', (x, -.105, .84), (.035, .025, 1.56), edge)
cube('keystone', (0, -.108, 1.68), (.16, .03, .17), edge)

hinge = bpy.data.objects.new('door_hinge', None)
bpy.context.collection.objects.link(hinge)
hinge.location = (-.38, 0, 0)

# Coordinates of children are relative to the hinge; -Y is the room side.
cube('oak_leaf', (.37, 0, .77), (.74, .075, 1.43), wood, hinge)
for x in (.13, .34, .55):
    cube('leaf_plank', (x, -.043, .77), (.175, .018, 1.37), wood_edge, hinge)
for face in (-.055, .055):
    for z in (.28, 1.22):
        cube('iron_strap', (.36, face, z), (.67, .028, .055), iron, hinge)
for z in (.15, 1.35):
    cube('hinge_pin', (0, .07, z), (.06, .06, .10), iron, hinge)

for face, suffix in ((-.073, 'room'), (.073, 'corridor')):
    # Large backplate, spindle and lever make the handle readable from both sides.
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=.065, location=(.61, face, .83))
    plate = bpy.context.object; plate.name = f'handle_backplate_{suffix}'; plate.scale.y = .24
    plate.data.materials.append(iron); plate.parent = hinge
    cube(f'handle_lever_{suffix}', (.51, face * 1.18, .83), (.23, .035, .045), iron, hinge)
    cube(f'handle_spindle_{suffix}', (.61, face * 1.10, .83), (.05, .045, .05), iron, hinge)

hinge.animation_data_create()
action = bpy.data.actions.new('open')
hinge.animation_data.action = action
for frame, angle in ((1, 0), (5, -.06), (18, -math.pi / 2)):
    hinge.rotation_euler.z = angle
    hinge.keyframe_insert(data_path='rotation_euler', index=2, frame=frame)
track = hinge.animation_data.nla_tracks.new()
track.name = 'open'
track.strips.new('open', 1, action)
track.mute = True
hinge.animation_data.action = None
hinge.rotation_euler.z = 0
scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(source))

track.mute = False
bpy.ops.object.select_all(action='DESELECT')
for obj in scene.objects:
    if obj.type in {'MESH', 'EMPTY'}:
        obj.select_set(True)
bpy.context.view_layer.objects.active = hinge
bpy.ops.export_scene.gltf(filepath=str(export), export_format='GLB', use_selection=True,
    export_animations=True, export_animation_mode='NLA_TRACKS')
track.mute = True

bpy.ops.object.camera_add(location=(2.0, 2.6, 2.0))
camera = bpy.context.object
camera.rotation_euler = (Vector((0, 0, .85)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 2.2
scene.camera = camera
scene.render.engine = 'BLENDER_WORKBENCH'
scene.display.shading.light = 'STUDIO'
scene.display.shading.color_type = 'MATERIAL'
scene.display.shading.show_shadows = True
scene.display.shading.show_cavity = True
scene.render.resolution_x = 900
scene.render.resolution_y = 900
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = str(preview)
bpy.ops.render.render(write_still=True)
print('CREATED', source, export, preview)
