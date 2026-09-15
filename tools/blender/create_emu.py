"""Original stylized emu. Blender 4.5 LTS; no external assets."""
import bpy,math
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[2];N='emu';S=R/f'art/blender/creatures/{N}.blend';E=R/f'public/assets/creatures/{N}.glb';P=R/f'art/previews/{N}.png'
for p in(S,E,P):p.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False);bpy.context.preferences.filepaths.save_version=0;sc=bpy.context.scene;sc.unit_settings.system='METRIC';sc.render.fps=24
def mat(n,c):
 m=bpy.data.materials.new(n);m.diffuse_color=(*c,1);m.use_nodes=True;m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*c,1);m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.88;return m
brown=mat('emu_feathers',(.24,.16,.10));tan=mat('feather_tips',(.47,.34,.20));skin=mat('blue_gray_skin',(.28,.36,.39));dark=mat('beak_claws',(.035,.03,.025));amber=mat('alert_eyes',(.78,.48,.10));parts=[]
def ell(n,c,s,m,b,sub=1):
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub,radius=1,location=c);o=bpy.context.object;o.name=n;o.scale=s;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m);o.vertex_groups.new(name=b).add(list(range(len(o.data.vertices))),1,'REPLACE');parts.append(o)
def cone(n,a,z,r,m,b):
 d=Vector(z)-Vector(a);bpy.ops.mesh.primitive_cone_add(vertices=7,radius1=r,radius2=0,depth=d.length,location=(Vector(a)+Vector(z))/2);o=bpy.context.object;o.name=n;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();bpy.ops.object.transform_apply(location=False,rotation=True,scale=True);o.data.materials.append(m);o.vertex_groups.new(name=b).add(list(range(len(o.data.vertices))),1,'REPLACE');parts.append(o)
ell('body',(0,.10,1.02),(.34,.43,.46),brown,'body',2);ell('chest',(0,-.20,1.03),(.27,.23,.36),tan,'body',2);ell('neck',(0,-.25,1.43),(.105,.12,.48),skin,'neck',2);ell('head',(0,-.31,1.82),(.15,.19,.15),brown,'head',2);ell('face',(0,-.43,1.80),(.115,.12,.10),skin,'head',2);cone('beak',(0,-.48,1.80),(0,-.72,1.76),.085,dark,'head')
for side,s in [('L',1),('R',-1)]:
 ell('eye.'+side,(s*.105,-.445,1.85),(.026,.025,.027),amber,'head',2);ell('wing.'+side,(s*.30,-.02,1.12),(.09,.27,.30),tan,'wing.'+side);ell('thigh.'+side,(s*.19,.13,.70),(.13,.16,.32),brown,'leg.'+side);ell('shin.'+side,(s*.19,.02,.31),(.065,.075,.34),skin,'leg.'+side)
 for toe in range(3):
  x=s*.19+(toe-1)*.075;cone(f'toe.{side}.{toe}',(s*.19,-.01,.06),(x,-.27-abs(toe-1)*.03,.025),.025,skin,'leg.'+side);cone(f'claw.{side}.{toe}',(x,-.27-abs(toe-1)*.03,.025),(x,-.35-abs(toe-1)*.03,.018),.018,dark,'leg.'+side)
for ring in range(5):
 z=.86+ring*.15
 for i in range(10):
  a=i*math.tau/10;cone(f'feather.{ring}.{i}',(math.sin(a)*.22,.10+math.cos(a)*.28,z),(math.sin(a)*(.30+ring*.012),.10+math.cos(a)*(.38+ring*.01),z-.14),.045,tan if(i+ring)%4==0 else brown,'body')
for i in range(7):cone(f'crown.{i}',((i-3)*.025,-.25,1.91),((i-3)*.04,-.18,2.06-abs(i-3)*.015),.022,brown,'head')
bpy.ops.object.select_all(action='DESELECT');[o.select_set(True)for o in parts];bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();mesh=bpy.context.object;mesh.name=N+'_mesh';sc.cursor.location=(0,0,0);bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
arm=bpy.data.armatures.new(N+'_skeleton');rig=bpy.data.objects.new(N+'_rig',arm);sc.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
def bone(n,h,t,p=None):
 b=arm.edit_bones.new(n);b.head=h;b.tail=t;b.parent=arm.edit_bones[p]if p else None
bone('root',(0,0,0),(0,0,.18));bone('body',(0,.1,.82),(0,-.12,1.25),'root');bone('neck',(0,-.18,1.2),(0,-.29,1.72),'body');bone('head',(0,-.29,1.7),(0,-.48,1.82),'neck')
for side,s in [('L',1),('R',-1)]:bone('wing.'+side,(s*.18,-.02,1.25),(s*.34,-.02,.98),'body');bone('leg.'+side,(s*.19,.1,.82),(s*.19,-.02,.05),'body')
bpy.ops.object.mode_set(mode='OBJECT');mesh.modifiers.new('skin','ARMATURE').object=rig;mesh.parent=rig;rig.animation_data_create()
def idle(t):rig.pose.bones['neck'].rotation_euler.z=.07*math.sin(t*math.tau);rig.pose.bones['head'].rotation_euler.z=.10*math.sin(t*math.tau+.4)
def move(t):rig.pose.bones['leg.L'].rotation_euler.x=.72*math.sin(t*math.tau);rig.pose.bones['leg.R'].rotation_euler.x=-.72*math.sin(t*math.tau);rig.pose.bones['root'].location.z=.05*abs(math.sin(t*math.tau))
def attack(t):q=math.sin(math.pi*t)**2;rig.pose.bones['neck'].rotation_euler.x=-.65*q;rig.pose.bones['head'].rotation_euler.x=-.35*q;rig.pose.bones['leg.L'].rotation_euler.x=-1.05*q
def hurt(t):rig.pose.bones['body'].rotation_euler.z=.25*math.sin(math.pi*t)*(1-t);rig.pose.bones['neck'].rotation_euler.x=.24*math.sin(math.pi*t)
def death(t):q=min(1,t*1.3);rig.pose.bones['root'].rotation_euler.z=1.48*q;rig.pose.bones['root'].location.z=.25*q
for n,l,pose in[('idle',49,idle),('move',25,move),('attack',19,attack),('hurt',13,hurt),('death',31,death)]:
 a=bpy.data.actions.new(n);rig.animation_data.action=a
 for f in range(1,l+1):
  for b in rig.pose.bones:b.rotation_mode='XYZ';b.rotation_euler=(0,0,0);b.location=(0,0,0);b.scale=(1,1,1)
  pose((f-1)/(l-1))
  for b in rig.pose.bones:
   for prop in('rotation_euler','location','scale'):b.keyframe_insert(prop,frame=f)
 tr=rig.animation_data.nla_tracks.new();tr.name=n;tr.strips.new(n,1,a);tr.mute=True;rig.animation_data.action=None
for b in rig.pose.bones:b.rotation_euler=(0,0,0);b.location=(0,0,0);b.scale=(1,1,1)
sc.frame_set(1);bpy.ops.wm.save_as_mainfile(filepath=str(S));[setattr(t,'mute',False)for t in rig.animation_data.nla_tracks];bpy.ops.object.select_all(action='DESELECT');mesh.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=rig;bpy.ops.export_scene.gltf(filepath=str(E),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True);[setattr(t,'mute',True)for t in rig.animation_data.nla_tracks];sc.frame_set(1)
bpy.ops.object.camera_add(location=(2.5,-4.2,2.45));cam=bpy.context.object;cam.rotation_euler=(Vector((0,-.04,1.05))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=2.55;sc.camera=cam;sc.render.engine='BLENDER_WORKBENCH';sc.display.shading.light='STUDIO';sc.display.shading.color_type='MATERIAL';sc.display.shading.show_shadows=True;sc.display.shading.show_cavity=True;sc.display.shading.background_type='WORLD';sc.world.color=(.035,.045,.065);sc.render.resolution_x=1000;sc.render.resolution_y=800;sc.render.resolution_percentage=100;sc.render.image_settings.file_format='PNG';sc.render.filepath=str(P);bpy.ops.render.render(write_still=True);print('CREATED',S,E,P)
