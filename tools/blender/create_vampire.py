"""Original aristocratic vampire. Blender 4.5 LTS; no external assets."""
import bpy
import math
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'art/blender/creatures/vampire.blend'
EXPORT=ROOT/'public/assets/creatures/vampire.glb'
PREVIEW=ROOT/'art/previews/vampire.png'
for path in (SOURCE,EXPORT,PREVIEW): path.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version=0
scene=bpy.context.scene; scene.unit_settings.system='METRIC'; scene.render.fps=24

def material(name,color,roughness=.82):
    mat=bpy.data.materials.new(name); mat.diffuse_color=(*color,1); mat.use_nodes=True
    bsdf=mat.node_tree.nodes.get('Principled BSDF'); bsdf.inputs['Base Color'].default_value=(*color,1)
    bsdf.inputs['Roughness'].default_value=roughness
    return mat

skin=material('vampire_pale_skin',(.58,.56,.62)); rot=material('vampire_cape_lining',(.34,.025,.055))
bruise=material('vampire_velvet',(.18,.025,.08)); shirt=material('vampire_black_coat',(.035,.025,.055))
trouser=material('vampire_trousers',(.025,.02,.035)); blood=material('vampire_cravat',(.48,.02,.04))
bone_mat=material('vampire_fangs',(.88,.84,.70)); eye=material('vampire_red_eye',(.85,.04,.03))
dark=material('vampire_hair_boots',(.012,.009,.018)); parts=[]

def part(name,center,scale,mat,bone,shape='ico'):
    if shape=='cube': bpy.ops.mesh.primitive_cube_add(size=2,location=center)
    else: bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=center)
    obj=bpy.context.object; obj.name=name; obj.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    obj.data.materials.append(mat); obj.vertex_groups.new(name=bone).add(list(range(len(obj.data.vertices))),1,'REPLACE')
    parts.append(obj); return obj

def cone(name,base,tip,radius,mat,bone):
    delta=Vector(tip)-Vector(base)
    bpy.ops.mesh.primitive_cone_add(vertices=6,radius1=radius,radius2=0,depth=delta.length,location=(Vector(base)+Vector(tip))/2)
    obj=bpy.context.object; obj.name=name; obj.rotation_euler=delta.to_track_quat('Z','Y').to_euler()
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    obj.data.materials.append(mat); obj.vertex_groups.new(name=bone).add(list(range(len(obj.data.vertices))),1,'REPLACE')
    parts.append(obj)

# Tall vampire facing Blender -Y, with a black coat, red cravat, fangs, and swept cape.
part('torso',(0,.01,.91),(.25,.16,.36),shirt,'spine')
part('shirt_tear',(-.09,-.165,.96),(.095,.018,.13),blood,'spine')
part('exposed_ribs',(-.09,-.19,.96),(.075,.018,.105),bone_mat,'spine')
for z in (.90,.96,1.02): part(f'rib.{z}',(-.09,-.213,z),(.08,.012,.012),bone_mat,'spine','cube')
part('head',(.035,-.04,1.40),(.22,.18,.23),skin,'head')
part('cheek',(-.12,-.17,1.34),(.09,.065,.11),skin,'head')
part('jaw',(.035,-.18,1.26),(.17,.10,.09),skin,'jaw')
part('mouth',(.035,-.275,1.27),(.12,.015,.026),dark,'jaw','cube')
for i in range(5):
    x=-.065+i*.034
    cone(f'tooth.{i}',(x,-.29,1.29),(x,-.30,1.25),.010,bone_mat,'jaw')
part('nose',(.035,-.245,1.40),(.06,.06,.055),rot,'head')
part('eye.L',(.12,-.205,1.44),(.038,.022,.032),eye,'head')
part('pupil.L',(.12,-.226,1.44),(.011,.007,.020),dark,'head')
part('eye.R',(-.055,-.211,1.44),(.038,.022,.032),eye,'head')
part('widows_peak',(-.02,-.13,1.55),(.16,.05,.07),dark,'head')
part('hair',(.02,.04,1.58),(.20,.16,.075),dark,'head')
for side,sign in [('L',1),('R',-1)]:
    arm_z=.82 if side=='L' else .88
    part('upper_arm.'+side,(sign*.32,.01,1.00),(.10,.105,.23),skin if side=='L' else bruise,'arm.'+side)
    part('forearm.'+side,(sign*.35,-.05,arm_z),(.085,.09,.20),skin,'arm.'+side)
    part('hand.'+side,(sign*.36,-.08,arm_z-.18),(.095,.09,.10),rot,'arm.'+side)
    for finger in range(3):
        x=sign*(.33+finger*.03)
        cone(f'finger.{side}.{finger}',(x,-.13,arm_z-.22),(x,-.23,arm_z-.27),.015,skin,'arm.'+side)
    leg_x=sign*.13
    part('thigh.'+side,(leg_x,.01,.43),(.12,.13,.25),trouser,'leg.'+side)
    part('shin.'+side,(leg_x,-.01,.21),(.09,.10,.18),skin if side=='R' else trouser,'leg.'+side)
    foot_y=-.12 if side=='L' else -.07
    part('foot.'+side,(leg_x,foot_y,.075),(.13,.22,.075),rot,'leg.'+side,'cube')
part('cape',(0,.18,.92),(.36,.055,.55),dark,'spine','cube'); cone('cape_tail.L',(-.18,.20,.72),(-.34,.34,.08),.13,rot,'spine'); cone('cape_tail.R',(.18,.20,.72),(.34,.34,.08),.13,rot,'spine')

bpy.ops.object.select_all(action='DESELECT')
for obj in parts: obj.select_set(True)
bpy.context.view_layer.objects.active=parts[0]; bpy.ops.object.join()
mesh=bpy.context.object; mesh.name='vampire_mesh'; scene.cursor.location=(0,0,0); bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
armature=bpy.data.armatures.new('vampire_skeleton'); rig=bpy.data.objects.new('vampire_rig',armature)
scene.collection.objects.link(rig); bpy.context.view_layer.objects.active=rig; bpy.ops.object.mode_set(mode='EDIT')
def bone(name,head,tail,parent=None):
    b=armature.edit_bones.new(name); b.head=head; b.tail=tail
    if parent: b.parent=armature.edit_bones[parent]
bone('root',(0,0,0),(0,0,.18)); bone('spine',(0,0,.64),(0,0,1.18),'root')
bone('head',(0,0,1.18),(0,0,1.63),'spine'); bone('jaw',(0,-.12,1.33),(0,-.27,1.26),'head')
for side,sign in [('L',1),('R',-1)]:
    bone('arm.'+side,(sign*.27,0,1.10),(sign*.36,-.06,.62),'spine')
    bone('leg.'+side,(sign*.13,0,.63),(sign*.13,-.04,.08),'root')
bpy.ops.object.mode_set(mode='OBJECT'); mesh.modifiers.new('skin','ARMATURE').object=rig; mesh.parent=rig; rig.animation_data_create()

def idle(t):
    rig.pose.bones['spine'].rotation_euler.z=-.10+.025*math.sin(t*math.tau)
    rig.pose.bones['head'].rotation_euler.y=.12+.07*math.sin(t*math.tau)
    rig.pose.bones['jaw'].rotation_euler.x=.08+.04*math.sin(t*math.tau)
def move(t):
    rig.pose.bones['spine'].rotation_euler.x=-.18; rig.pose.bones['spine'].rotation_euler.z=-.10
    for side,sign in [('L',1),('R',-1)]:
        rig.pose.bones['leg.'+side].rotation_euler.x=sign*.32*math.sin(t*math.tau)
    rig.pose.bones['arm.L'].rotation_euler.x=-.50+.10*math.sin(t*math.tau)
    rig.pose.bones['arm.R'].rotation_euler.x=-.75-.08*math.sin(t*math.tau)
    rig.pose.bones['root'].location.z=.025*abs(math.sin(t*math.tau))
def attack(t):
    pulse=math.sin(t*math.pi)**2
    rig.pose.bones['spine'].rotation_euler.x=-.28*pulse
    rig.pose.bones['head'].rotation_euler.x=.20*pulse
    rig.pose.bones['jaw'].rotation_euler.x=.55*pulse
    rig.pose.bones['arm.L'].rotation_euler.x=-1.05*pulse
    rig.pose.bones['arm.R'].rotation_euler.x=-1.25*pulse
    rig.pose.bones['root'].location.y=-.10*pulse
def hurt(t):
    pulse=math.sin(t*math.pi)*(1-t)
    rig.pose.bones['spine'].rotation_euler.z=.30*pulse; rig.pose.bones['head'].rotation_euler.z=-.24*pulse
def death(t):
    p=min(1,t*1.3); rig.pose.bones['root'].rotation_euler.x=-1.48*p; rig.pose.bones['root'].location.z=.16*p
    rig.pose.bones['arm.L'].rotation_euler.z=-.42*p; rig.pose.bones['arm.R'].rotation_euler.z=.36*p

for name,length,pose in [('idle',49,idle),('move',33,move),('attack',21,attack),('hurt',13,hurt),('death',31,death)]:
    action=bpy.data.actions.new(name); rig.animation_data.action=action
    for frame in range(1,length+1):
        for b in rig.pose.bones: b.rotation_mode='XYZ'; b.rotation_euler=(0,0,0); b.location=(0,0,0); b.scale=(1,1,1)
        pose((frame-1)/(length-1))
        for b in rig.pose.bones:
            for prop in ('rotation_euler','location','scale'): b.keyframe_insert(prop,frame=frame)
    track=rig.animation_data.nla_tracks.new(); track.name=name; track.strips.new(name,1,action); track.mute=True
    rig.animation_data.action=None
for b in rig.pose.bones: b.rotation_euler=(0,0,0); b.location=(0,0,0); b.scale=(1,1,1)
scene.frame_set(1); bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
for track in rig.animation_data.nla_tracks: track.mute=False
bpy.ops.object.select_all(action='DESELECT'); mesh.select_set(True); rig.select_set(True); bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(EXPORT),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True)
for track in rig.animation_data.nla_tracks: track.mute=True
for b in rig.pose.bones: b.rotation_euler=(0,0,0); b.location=(0,0,0); b.scale=(1,1,1)
scene.frame_set(1); bpy.ops.object.camera_add(location=(2.35,-3.6,2.2)); camera=bpy.context.object
camera.rotation_euler=(Vector((0,0,.78))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO'; camera.data.ortho_scale=2.15; scene.camera=camera
scene.render.engine='BLENDER_WORKBENCH'; scene.display.shading.light='STUDIO'; scene.display.shading.color_type='MATERIAL'
scene.display.shading.show_shadows=True; scene.display.shading.show_cavity=True; scene.display.shading.background_type='WORLD'; scene.world.color=(.035,.045,.065)
scene.render.resolution_x=900; scene.render.resolution_y=900; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'; scene.render.filepath=str(PREVIEW); bpy.ops.render.render(write_still=True)
print('CREATED',SOURCE,EXPORT,PREVIEW)
