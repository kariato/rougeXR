"""Original amphibious aquator. Blender 4.5 LTS; no external assets."""
import bpy,math
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[2];N='aquator';S=R/f'art/blender/creatures/{N}.blend';E=R/f'public/assets/creatures/{N}.glb';P=R/f'art/previews/{N}.png'
for p in(S,E,P):p.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False);bpy.context.preferences.filepaths.save_version=0;sc=bpy.context.scene;sc.unit_settings.system='METRIC';sc.render.fps=24
def mat(n,c,metal=0):
 m=bpy.data.materials.new(n);m.diffuse_color=(*c,1);m.use_nodes=True;b=m.node_tree.nodes['Principled BSDF'];b.inputs['Base Color'].default_value=(*c,1);b.inputs['Roughness'].default_value=.68;b.inputs['Metallic'].default_value=metal;return m
teal=mat('aquator_teal',(.055,.30,.31));scale=mat('aquator_scales',(.10,.48,.45));belly=mat('aquator_belly',(.35,.63,.51));fin=mat('aquator_fins',(.12,.55,.67));rust=mat('rust_touch',(.58,.20,.045),.25);dark=mat('deep_water',(.012,.045,.055));eye=mat('aquator_eye',(.82,.72,.12));parts=[]
def part(n,c,s,m,b,shape='ico'):
 (bpy.ops.mesh.primitive_cube_add(size=2,location=c)if shape=='cube'else bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=c));o=bpy.context.object;o.name=n;o.scale=s;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m);o.vertex_groups.new(name=b).add(list(range(len(o.data.vertices))),1,'REPLACE');parts.append(o);return o
def cone(n,a,z,r,m,b):
 d=Vector(z)-Vector(a);bpy.ops.mesh.primitive_cone_add(vertices=6,radius1=r,radius2=0,depth=d.length,location=(Vector(a)+Vector(z))/2);o=bpy.context.object;o.name=n;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();bpy.ops.object.transform_apply(location=False,rotation=True,scale=True);o.data.materials.append(m);o.vertex_groups.new(name=b).add(list(range(len(o.data.vertices))),1,'REPLACE');parts.append(o)
# Hunched amphibious armor-ruster, facing Blender -Y.
part('body',(0,.03,.75),(.30,.22,.38),teal,'core');part('belly',(0,-.20,.74),(.22,.045,.29),belly,'core');part('head',(0,-.08,1.18),(.27,.23,.23),scale,'head');part('muzzle',(0,-.28,1.12),(.19,.10,.10),belly,'head');part('jaw',(0,-.27,1.04),(.17,.08,.05),dark,'jaw')
for i in range(5):cone(f'crest.{i}',(0,.04+i*.045,1.24-i*.055),(0,.12+i*.05,1.48-i*.06),.065,fin,'head'if i<2 else'core')
for side,sgn in[('L',1),('R',-1)]:
 part('eye.'+side,(sgn*.15,-.25,1.24),(.045,.025,.04),eye,'head');part('pupil.'+side,(sgn*.15,-.272,1.24),(.014,.008,.025),dark,'head');part('arm.'+side,(sgn*.38,-.01,.78),(.12,.13,.31),teal,'arm.'+side);part('hand.'+side,(sgn*.40,-.12,.48),(.16,.13,.13),scale,'arm.'+side);part('rust_palm.'+side,(sgn*.40,-.24,.47),(.10,.025,.08),rust,'arm.'+side)
 for f in range(3):cone(f'webfinger.{side}.{f}',(sgn*(.34+f*.06),-.20,.46),(sgn*(.32+f*.08),-.34,.40),.025,fin,'arm.'+side)
 part('leg.'+side,(sgn*.16,.06,.34),(.13,.15,.25),teal,'leg.'+side);part('webfoot.'+side,(sgn*.16,-.10,.08),(.18,.25,.08),fin,'leg.'+side,'cube')
for i in range(4):part(f'body_scale.{i}',((i-1.5)*.10,-.235,.76+(i%2)*.13),(.035,.018,.055),scale,'core')
bpy.ops.object.select_all(action='DESELECT');[o.select_set(True)for o in parts];bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();mesh=bpy.context.object;mesh.name=N+'_mesh';sc.cursor.location=(0,0,0);bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
arm=bpy.data.armatures.new(N+'_skeleton');rig=bpy.data.objects.new(N+'_rig',arm);sc.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
def bone(n,h,t,p=None):b=arm.edit_bones.new(n);b.head=h;b.tail=t;b.parent=arm.edit_bones[p]if p else None
bone('root',(0,0,0),(0,0,.15));bone('core',(0,0,.45),(0,0,1.0),'root');bone('head',(0,0,1.0),(0,-.10,1.39),'core');bone('jaw',(0,-.18,1.08),(0,-.31,1.04),'head')
for side,sgn in[('L',1),('R',-1)]:bone('arm.'+side,(sgn*.28,0,.95),(sgn*.40,-.10,.45),'core');bone('leg.'+side,(sgn*.16,0,.48),(sgn*.16,-.07,.07),'root')
bpy.ops.object.mode_set(mode='OBJECT');mesh.modifiers.new('skin','ARMATURE').object=rig;mesh.parent=rig;rig.animation_data_create()
def idle(t):rig.pose.bones['head'].rotation_euler.y=.09*math.sin(t*math.tau);rig.pose.bones['jaw'].rotation_euler.x=.05*math.sin(t*math.tau)
def move(t):
 for side,sgn in[('L',1),('R',-1)]:rig.pose.bones['leg.'+side].rotation_euler.x=sgn*.40*math.sin(t*math.tau);rig.pose.bones['arm.'+side].rotation_euler.x=-sgn*.30*math.sin(t*math.tau)
 rig.pose.bones['root'].location.z=.03*abs(math.sin(t*math.tau))
def attack(t):
 q=math.sin(t*math.pi)**2;rig.pose.bones['arm.L'].rotation_euler.x=-1.35*q;rig.pose.bones['arm.R'].rotation_euler.x=-1.35*q;rig.pose.bones['core'].rotation_euler.x=-.22*q;rig.pose.bones['root'].location.y=-.10*q
def hurt(t):rig.pose.bones['core'].rotation_euler.z=.28*math.sin(t*math.pi)*(1-t)
def death(t):q=min(1,t*1.3);rig.pose.bones['root'].rotation_euler.x=-1.4*q;rig.pose.bones['root'].location.z=.15*q
for n,l,pose in[('idle',49,idle),('move',29,move),('attack',21,attack),('hurt',13,hurt),('death',31,death)]:
 a=bpy.data.actions.new(n);rig.animation_data.action=a
 for f in range(1,l+1):
  for b in rig.pose.bones:b.rotation_mode='XYZ';b.rotation_euler=(0,0,0);b.location=(0,0,0);b.scale=(1,1,1)
  pose((f-1)/(l-1))
  for b in rig.pose.bones:
   for prop in('rotation_euler','location','scale'):b.keyframe_insert(prop,frame=f)
 tr=rig.animation_data.nla_tracks.new();tr.name=n;tr.strips.new(n,1,a);tr.mute=True;rig.animation_data.action=None
for b in rig.pose.bones:b.rotation_euler=(0,0,0);b.location=(0,0,0);b.scale=(1,1,1)
sc.frame_set(1);bpy.ops.wm.save_as_mainfile(filepath=str(S));[setattr(t,'mute',False)for t in rig.animation_data.nla_tracks];bpy.ops.object.select_all(action='DESELECT');mesh.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=rig;bpy.ops.export_scene.gltf(filepath=str(E),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True);[setattr(t,'mute',True)for t in rig.animation_data.nla_tracks];sc.frame_set(1)
bpy.ops.object.camera_add(location=(2.25,-3.5,2.05));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,.68))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=2.0;sc.camera=cam;sc.render.engine='BLENDER_WORKBENCH';sc.display.shading.light='STUDIO';sc.display.shading.color_type='MATERIAL';sc.display.shading.show_shadows=True;sc.display.shading.show_cavity=True;sc.display.shading.background_type='WORLD';sc.world.color=(.035,.045,.065);sc.render.resolution_x=900;sc.render.resolution_y=900;sc.render.resolution_percentage=100;sc.render.image_settings.file_format='PNG';sc.render.filepath=str(P);bpy.ops.render.render(write_still=True);print('CREATED',S,E,P)
