"""Original armored orc. Blender 4.5 LTS; no external assets."""
import bpy
import math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'art/blender/creatures/orc.blend'
EXPORT = ROOT / 'public/assets/creatures/orc.glb'
PREVIEW = ROOT / 'art/previews/orc.png'
for path in (SOURCE, EXPORT, PREVIEW):
    path.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.render.fps = 24

def material(name, color, metallic=0.0, roughness=0.72):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    return mat

skin = material('orc_olive_skin', (0.20, 0.34, 0.105))
dark_skin = material('orc_shadow_skin', (0.105, 0.19, 0.055))
iron = material('orc_dark_iron', (0.18, 0.20, 0.19), 0.72, 0.42)
edge = material('orc_blade_edge', (0.48, 0.53, 0.52), 0.82, 0.27)
leather = material('orc_leather', (0.20, 0.075, 0.035))
cloth = material('orc_cloth', (0.30, 0.055, 0.025))
wood = material('orc_wood', (0.24, 0.12, 0.045))
bone_mat = material('orc_tusks', (0.78, 0.70, 0.49))
amber = material('orc_eyes', (0.95, 0.38, 0.025), 0.0, 0.25)
black = material('orc_pupils', (0.012, 0.009, 0.006))
parts=[]

def part(name, center, scale, mat, bone, shape='ico'):
    if shape == 'cube':
        bpy.ops.mesh.primitive_cube_add(size=2, location=center)
    else:
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1, location=center)
    obj=bpy.context.object
    obj.name=name; obj.scale=scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    obj.vertex_groups.new(name=bone).add(list(range(len(obj.data.vertices))),1,'REPLACE')
    parts.append(obj)
    return obj

def cone(name, base, tip, radius, mat, bone, vertices=6):
    delta=Vector(tip)-Vector(base)
    bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=radius,radius2=0,depth=delta.length,
        location=(Vector(base)+Vector(tip))/2)
    obj=bpy.context.object
    obj.name=name; obj.rotation_euler=delta.to_track_quat('Z','Y').to_euler()
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    obj.data.materials.append(mat)
    obj.vertex_groups.new(name=bone).add(list(range(len(obj.data.vertices))),1,'REPLACE')
    parts.append(obj)
    return obj

def cylinder(name, center, radius, depth, mat, bone, rotation=(0,0,0), vertices=10):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=center,rotation=rotation)
    obj=bpy.context.object
    obj.name=name
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    obj.data.materials.append(mat)
    obj.vertex_groups.new(name=bone).add(list(range(len(obj.data.vertices))),1,'REPLACE')
    parts.append(obj)
    return obj

# Broad armored raider, 1.7 m tall, facing Blender -Y.
part('torso',(0,0,0.91),(0.31,0.19,0.38),cloth,'spine')
part('chest_armor',(0,-0.16,0.96),(0.30,0.065,0.27),iron,'spine')
part('belt',(0,-0.01,0.65),(0.31,0.20,0.055),leather,'spine','cube')
part('buckle',(0,-0.225,0.65),(0.055,0.022,0.045),edge,'spine','cube')
part('head',(0,-0.025,1.37),(0.25,0.20,0.245),skin,'head')
part('jaw',(0,-0.16,1.25),(0.22,0.12,0.12),dark_skin,'head')
part('nose',(0,-0.268,1.38),(0.075,0.07,0.065),skin,'head')
part('mouth',(0,-0.278,1.25),(0.14,0.014,0.022),black,'head','cube')
part('helmet',(0,0.005,1.51),(0.255,0.205,0.11),iron,'head')
cone('helmet_spike',(0,0.01,1.57),(0,0.03,1.76),0.06,edge,'head')
for side,sign in [('L',1),('R',-1)]:
    cone('ear.'+side,(sign*0.20,-0.01,1.39),(sign*0.39,0.015,1.47),0.075,skin,'head')
    part('eye.'+side,(sign*0.095,-0.218,1.42),(0.039,0.023,0.030),amber,'head')
    part('pupil.'+side,(sign*0.095,-0.240,1.42),(0.010,0.008,0.020),black,'head')
    cone('tusk.'+side,(sign*0.105,-0.278,1.22),(sign*0.12,-0.292,1.34),0.025,bone_mat,'head')
    part('shoulder.'+side,(sign*0.35,0,1.05),(0.17,0.17,0.14),iron,'arm.'+side)
    part('upper_arm.'+side,(sign*0.39,-0.01,0.84),(0.13,0.13,0.22),skin,'arm.'+side)
    part('bracer.'+side,(sign*0.41,-0.035,0.65),(0.14,0.14,0.12),iron,'arm.'+side)
    part('hand.'+side,(sign*0.42,-0.05,0.52),(0.12,0.11,0.12),skin,'arm.'+side)
    part('leg.'+side,(sign*0.16,0,0.40),(0.14,0.15,0.25),leather,'leg.'+side)
    part('boot.'+side,(sign*0.16,-0.09,0.12),(0.15,0.23,0.12),iron,'leg.'+side,'cube')
# Right arm carries a cleaver; left arm carries a thick round shield.
cylinder('cleaver_handle',(-0.42,-0.06,0.48),0.035,0.58,wood,'arm.R')
blade=part('cleaver_blade',(-0.42,-0.06,0.22),(0.16,0.055,0.19),iron,'arm.R','cube')
blade.rotation_euler.y=0.16
part('cleaver_edge',(-0.51,-0.119,0.22),(0.035,0.018,0.19),edge,'arm.R','cube')
cylinder('shield',(0.48,-0.18,0.76),0.31,0.075,iron,'arm.L',(math.pi/2,0,0),12)
cylinder('shield_boss',(0.48,-0.225,0.76),0.095,0.10,edge,'arm.L',(math.pi/2,0,0),10)
for angle in range(0,360,90):
    a=math.radians(angle)
    cylinder(f'shield_rivet.{angle}',(0.48+0.23*math.cos(a),-0.231,0.76+0.23*math.sin(a)),0.025,0.095,edge,'arm.L',(math.pi/2,0,0),8)

bpy.ops.object.select_all(action='DESELECT')
for obj in parts: obj.select_set(True)
bpy.context.view_layer.objects.active=parts[0]
bpy.ops.object.join()
mesh=bpy.context.object; mesh.name='orc_mesh'
scene.cursor.location=(0,0,0); bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
armature=bpy.data.armatures.new('orc_skeleton')
rig=bpy.data.objects.new('orc_rig',armature); scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active=rig; bpy.ops.object.mode_set(mode='EDIT')
def bone(name,head,tail,parent=None):
    b=armature.edit_bones.new(name); b.head=head; b.tail=tail
    if parent: b.parent=armature.edit_bones[parent]
bone('root',(0,0,0),(0,0,0.20))
bone('spine',(0,0,0.64),(0,0,1.17),'root')
bone('head',(0,0,1.17),(0,0,1.65),'spine')
for side,sign in [('L',1),('R',-1)]:
    bone('arm.'+side,(sign*0.29,0,1.10),(sign*0.42,-0.04,0.52),'spine')
    bone('leg.'+side,(sign*0.16,0,0.64),(sign*0.16,-0.08,0.10),'root')
bpy.ops.object.mode_set(mode='OBJECT')
mesh.modifiers.new('skin','ARMATURE').object=rig; mesh.parent=rig; rig.animation_data_create()

def idle(t):
    rig.pose.bones['head'].rotation_euler.y=0.06*math.sin(t*math.tau)
    rig.pose.bones['root'].location.z=0.010*math.sin(t*math.tau)
def move(t):
    for side,sign in [('L',1),('R',-1)]:
        rig.pose.bones['leg.'+side].rotation_euler.x=sign*0.46*math.sin(t*math.tau)
        rig.pose.bones['arm.'+side].rotation_euler.x=-sign*0.24*math.sin(t*math.tau)
    rig.pose.bones['root'].location.z=0.035*abs(math.sin(t*math.tau))
def attack(t):
    swing=math.sin(t*math.pi)
    rig.pose.bones['arm.R'].rotation_euler.x=-2.25*swing
    rig.pose.bones['arm.R'].rotation_euler.z=-0.35*swing
    rig.pose.bones['arm.L'].rotation_euler.x=-0.35*swing
    rig.pose.bones['spine'].rotation_euler.z=-0.25*swing
def hurt(t):
    pulse=math.sin(t*math.pi)*(1-t)
    rig.pose.bones['spine'].rotation_euler.x=-0.32*pulse
    rig.pose.bones['head'].rotation_euler.z=0.18*pulse
def death(t):
    p=min(1,t*1.35)
    rig.pose.bones['root'].rotation_euler.z=1.42*p
    rig.pose.bones['root'].location.z=0.13*p
    rig.pose.bones['arm.L'].rotation_euler.x=-0.55*p

for name,length,pose in [('idle',49,idle),('move',25,move),('attack',19,attack),('hurt',13,hurt),('death',31,death)]:
    action=bpy.data.actions.new(name); rig.animation_data.action=action
    for frame in range(1,length+1):
        for b in rig.pose.bones:
            b.rotation_mode='XYZ'; b.rotation_euler=(0,0,0); b.location=(0,0,0); b.scale=(1,1,1)
        pose((frame-1)/(length-1))
        for b in rig.pose.bones:
            for prop in ('rotation_euler','location','scale'): b.keyframe_insert(prop,frame=frame)
    track=rig.animation_data.nla_tracks.new(); track.name=name; track.strips.new(name,1,action); track.mute=True
    rig.animation_data.action=None
for b in rig.pose.bones: b.rotation_euler=(0,0,0); b.location=(0,0,0); b.scale=(1,1,1)
scene.frame_set(1); bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
for track in rig.animation_data.nla_tracks: track.mute=False
bpy.ops.object.select_all(action='DESELECT'); mesh.select_set(True); rig.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(EXPORT),export_format='GLB',use_selection=True,
    export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True)
for track in rig.animation_data.nla_tracks: track.mute=True
for b in rig.pose.bones: b.rotation_euler=(0,0,0); b.location=(0,0,0); b.scale=(1,1,1)
scene.frame_set(1)
bpy.ops.object.camera_add(location=(2.5,-3.8,2.35))
camera=bpy.context.object
camera.rotation_euler=(Vector((0,0,0.80))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO'; camera.data.ortho_scale=2.25; scene.camera=camera
scene.render.engine='BLENDER_WORKBENCH'; scene.display.shading.light='STUDIO'; scene.display.shading.color_type='MATERIAL'
scene.display.shading.show_shadows=True; scene.display.shading.show_cavity=True
scene.display.shading.background_type='WORLD'; scene.world.color=(0.035,0.045,0.065)
scene.render.resolution_x=900; scene.render.resolution_y=900; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'; scene.render.filepath=str(PREVIEW)
bpy.ops.render.render(write_still=True)
print('CREATED',SOURCE,EXPORT,PREVIEW)
