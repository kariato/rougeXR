"""Original serpent-haired medusa. Blender 4.5 LTS; no external assets."""
import bpy,math
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[2];N='medusa';S=R/f'art/blender/creatures/{N}.blend';E=R/f'public/assets/creatures/{N}.glb';P=R/f'art/previews/{N}.png'
for p in(S,E,P):p.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False);bpy.context.preferences.filepaths.save_version=0;sc=bpy.context.scene;sc.unit_settings.system='METRIC';sc.render.fps=24
def mat(n,c,metal=0):
 m=bpy.data.materials.new(n);m.diffuse_color=(*c,1);m.use_nodes=True;b=m.node_tree.nodes['Principled BSDF'];b.inputs['Base Color'].default_value=(*c,1);b.inputs['Roughness'].default_value=.72;b.inputs['Metallic'].default_value=metal;return m
skin=mat('medusa_skin',(.32,.48,.31));leaf=mat('serpent_dress',(.10,.23,.16));light=mat('snake_scales',(.30,.56,.18));hair=mat('snake_hair',(.09,.32,.12));gold=mat('medusa_gold',(.72,.43,.06),.65);eye=mat('petrifying_eyes',(.85,.76,.12));parts=[]
def part(n,c,s,m,b,shape='ico'):
 (bpy.ops.mesh.primitive_cube_add(size=2,location=c)if shape=='cube'else bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=c));o=bpy.context.object;o.name=n;o.scale=s;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m);o.vertex_groups.new(name=b).add(list(range(len(o.data.vertices))),1,'REPLACE');parts.append(o);return o
def cone(n,a,z,r,m,b):
 d=Vector(z)-Vector(a);bpy.ops.mesh.primitive_cone_add(vertices=7,radius1=r,radius2=0,depth=d.length,location=(Vector(a)+Vector(z))/2);o=bpy.context.object;o.name=n;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();bpy.ops.object.transform_apply(location=False,rotation=True,scale=True);o.data.materials.append(m);o.vertex_groups.new(name=b).add(list(range(len(o.data.vertices))),1,'REPLACE');parts.append(o)
# Serpent-haired gorgon, facing Blender -Y.
cone('dress',(0,0,.92),(0,0,.08),.30,leaf,'spine');part('bodice',(0,-.01,1.12),(.20,.13,.27),light,'spine');part('head',(0,-.02,1.48),(.17,.14,.19),skin,'head');part('nose',(0,-.17,1.47),(.04,.045,.045),skin,'head');part('hair',(0,.03,1.58),(.19,.15,.13),hair,'head')
for i in range(7):cone(f'hair_lock.{i}',((i-3)*.045,.08,1.57),((i-3)*.06,.11,1.15-(i%2)*.10),.035,hair,'head')
for i in range(7):
 x=(i-3)*.06;part(f'snake_head.{i}',(x,.11,1.15-(i%2)*.10),(.045,.065,.04),light,'head');part(f'snake_eye.{i}',(x,.055,1.16-(i%2)*.10),(.009,.008,.009),eye,'head')
for side,sgn in[('L',1),('R',-1)]:
 cone('ear.'+side,(sgn*.14,-.02,1.49),(sgn*.28,0,1.54),.045,skin,'head');part('eye.'+side,(sgn*.065,-.145,1.51),(.022,.015,.021),eye,'head');part('arm.'+side,(sgn*.25,-.01,1.15),(.065,.07,.25),skin,'arm.'+side);part('hand.'+side,(sgn*.27,-.04,.91),(.055,.05,.065),skin,'arm.'+side);part('leg.'+side,(sgn*.09,.01,.34),(.065,.075,.27),skin,'leg.'+side);part('foot.'+side,(sgn*.09,-.08,.075),(.075,.16,.06),hair,'leg.'+side,'cube')
for i in range(6):cone(f'leaf_skirt.{i}',(((i%3)-1)*.16,-.02+(i//3)*.06,.72),( ((i%3)-1)*.22,-.04+(i//3)*.06,.22),.08,light if i%2 else leaf,'spine')
part('bracelet',( .27,-.08,.91),(.07,.03,.045),gold,'arm.L');part('gaze_gem',(.27,-.115,.91),(.028,.012,.035),eye,'arm.L')
bpy.ops.object.select_all(action='DESELECT');[o.select_set(True)for o in parts];bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();mesh=bpy.context.object;mesh.name=N+'_mesh';sc.cursor.location=(0,0,0);bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
arm=bpy.data.armatures.new(N+'_skeleton');rig=bpy.data.objects.new(N+'_rig',arm);sc.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
def bone(n,h,t,p=None):b=arm.edit_bones.new(n);b.head=h;b.tail=t;b.parent=arm.edit_bones[p]if p else None
bone('root',(0,0,0),(0,0,.15));bone('spine',(0,0,.65),(0,0,1.30),'root');bone('head',(0,0,1.30),(0,0,1.68),'spine')
for side,sgn in[('L',1),('R',-1)]:bone('arm.'+side,(sgn*.19,0,1.28),(sgn*.27,-.03,.90),'spine');bone('leg.'+side,(sgn*.09,0,.62),(sgn*.09,-.05,.07),'root')
bpy.ops.object.mode_set(mode='OBJECT');mesh.modifiers.new('skin','ARMATURE').object=rig;mesh.parent=rig;rig.animation_data_create()
def idle(t):rig.pose.bones['head'].rotation_euler.y=.11*math.sin(t*math.tau);rig.pose.bones['arm.L'].rotation_euler.z=.08*math.sin(t*math.tau)
def move(t):
 for side,sgn in[('L',1),('R',-1)]:rig.pose.bones['leg.'+side].rotation_euler.x=sgn*.55*math.sin(t*math.tau);rig.pose.bones['arm.'+side].rotation_euler.x=-sgn*.35*math.sin(t*math.tau)
 rig.pose.bones['root'].location.z=.045*abs(math.sin(t*math.tau))
def attack(t):q=math.sin(t*math.pi)**2;rig.pose.bones['arm.L'].rotation_euler.x=-1.05*q;rig.pose.bones['arm.R'].rotation_euler.x=-1.05*q;rig.pose.bones['head'].rotation_euler.x=-.18*q;rig.pose.bones['root'].location.y=-.08*q
def hurt(t):rig.pose.bones['spine'].rotation_euler.z=-.26*math.sin(t*math.pi)*(1-t)
def death(t):q=min(1,t*1.4);rig.pose.bones['root'].rotation_euler.z=1.42*q;rig.pose.bones['root'].location.z=.13*q
for n,l,pose in[('idle',49,idle),('move',23,move),('attack',17,attack),('hurt',11,hurt),('death',29,death)]:
 a=bpy.data.actions.new(n);rig.animation_data.action=a
 for f in range(1,l+1):
  for b in rig.pose.bones:b.rotation_mode='XYZ';b.rotation_euler=(0,0,0);b.location=(0,0,0);b.scale=(1,1,1)
  pose((f-1)/(l-1))
  for b in rig.pose.bones:
   for prop in('rotation_euler','location','scale'):b.keyframe_insert(prop,frame=f)
 tr=rig.animation_data.nla_tracks.new();tr.name=n;tr.strips.new(n,1,a);tr.mute=True;rig.animation_data.action=None
for b in rig.pose.bones:b.rotation_euler=(0,0,0);b.location=(0,0,0);b.scale=(1,1,1)
sc.frame_set(1);bpy.ops.wm.save_as_mainfile(filepath=str(S));[setattr(t,'mute',False)for t in rig.animation_data.nla_tracks];bpy.ops.object.select_all(action='DESELECT');mesh.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=rig;bpy.ops.export_scene.gltf(filepath=str(E),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True);[setattr(t,'mute',True)for t in rig.animation_data.nla_tracks];sc.frame_set(1)
bpy.ops.object.camera_add(location=(2.1,-3.3,2.1));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,.75))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=2.0;sc.camera=cam;sc.render.engine='BLENDER_WORKBENCH';sc.display.shading.light='STUDIO';sc.display.shading.color_type='MATERIAL';sc.display.shading.show_shadows=True;sc.display.shading.show_cavity=True;sc.display.shading.background_type='WORLD';sc.world.color=(.035,.045,.065);sc.render.resolution_x=900;sc.render.resolution_y=900;sc.render.resolution_percentage=100;sc.render.image_settings.file_format='PNG';sc.render.filepath=str(P);bpy.ops.render.render(write_still=True);print('CREATED',S,E,P)
