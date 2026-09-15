"""Original monstrous venus flytrap. Blender 4.5 LTS; no external assets."""
import bpy,math
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[2];N='venus-flytrap';S=R/f'art/blender/creatures/{N}.blend';E=R/f'public/assets/creatures/{N}.glb';P=R/f'art/previews/{N}.png'
for p in(S,E,P):p.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False);bpy.context.preferences.filepaths.save_version=0;sc=bpy.context.scene;sc.unit_settings.system='METRIC';sc.render.fps=24
def mat(n,c):
 m=bpy.data.materials.new(n);m.diffuse_color=(*c,1);m.use_nodes=True;b=m.node_tree.nodes['Principled BSDF'];b.inputs['Base Color'].default_value=(*c,1);b.inputs['Roughness'].default_value=.82;return m
green=mat('trap_green',(.10,.35,.09));light=mat('leaf_veins',(.30,.56,.13));mouth=mat('trap_mouth',(.48,.075,.10));tooth=mat('trap_teeth',(.79,.72,.39));soil=mat('root_soil',(.16,.075,.025));parts=[]
def part(n,c,s,m,b,shape='ico'):
 (bpy.ops.mesh.primitive_cube_add(size=2,location=c)if shape=='cube'else bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=c));o=bpy.context.object;o.name=n;o.scale=s;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m);o.vertex_groups.new(name=b).add(list(range(len(o.data.vertices))),1,'REPLACE');parts.append(o);return o
def cone(n,a,z,r,m,b):
 d=Vector(z)-Vector(a);bpy.ops.mesh.primitive_cone_add(vertices=7,radius1=r,radius2=0,depth=d.length,location=(Vector(a)+Vector(z))/2);o=bpy.context.object;o.name=n;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();bpy.ops.object.transform_apply(location=False,rotation=True,scale=True);o.data.materials.append(m);o.vertex_groups.new(name=b).add(list(range(len(o.data.vertices))),1,'REPLACE');parts.append(o)
# Rooted carnivorous plant; open mouth faces Blender -Y.
part('root_ball',(0,.05,.12),(.34,.30,.12),soil,'root');cone('stem',(0,.04,.16),(0,-.02,.83),.105,green,'stem');part('head',(0,-.08,.92),(.34,.27,.23),green,'head');part('upper_mouth',(0,-.29,1.02),(.29,.16,.11),mouth,'upper');part('lower_mouth',(0,-.29,.83),(.29,.16,.11),mouth,'lower')
for side,sgn in[('L',1),('R',-1)]:
 for i in range(6):
  x=sgn*(.04+i*.045);cone(f'tooth.{side}.{i}',(x,-.43,.96),(x,-.49,.89),.014,tooth,'upper');cone(f'lower_tooth.{side}.{i}',(x,-.43,.88),(x,-.49,.95),.014,tooth,'lower')
for side,sgn in[('L',1),('R',-1)]:
 cone('vine.'+side,(sgn*.12,.05,.35),(sgn*.55,-.12,.20),.055,green,'vine.'+side);part('vine_leaf.'+side,(sgn*.59,-.15,.19),(.20,.09,.055),light,'vine.'+side)
for i in range(5):
 a=i*math.tau/5;part(f'ground_leaf.{i}',(.38*math.cos(a),.20+.30*math.sin(a),.10),(.24,.09,.045),light,'root')
for i in range(4):part(f'vein.{i}',((i-1.5)*.10,-.445,.93),(.02,.012,.13),light,'head','cube')
bpy.ops.object.select_all(action='DESELECT');[o.select_set(True)for o in parts];bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();mesh=bpy.context.object;mesh.name=N+'_mesh';sc.cursor.location=(0,0,0);bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
arm=bpy.data.armatures.new(N+'_skeleton');rig=bpy.data.objects.new(N+'_rig',arm);sc.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
def bone(n,h,t,p=None):b=arm.edit_bones.new(n);b.head=h;b.tail=t;b.parent=arm.edit_bones[p]if p else None
bone('root',(0,0,0),(0,0,.14));bone('stem',(0,0,.16),(0,0,.83),'root');bone('head',(0,0,.82),(0,-.10,1.10),'stem');bone('upper',(0,-.10,.96),(0,-.38,1.02),'head');bone('lower',(0,-.10,.89),(0,-.38,.83),'head');bone('vine.L',(.10,0,.35),(.55,-.10,.20),'root');bone('vine.R',(-.10,0,.35),(-.55,-.10,.20),'root')
bpy.ops.object.mode_set(mode='OBJECT');mesh.modifiers.new('skin','ARMATURE').object=rig;mesh.parent=rig;rig.animation_data_create()
def idle(t):rig.pose.bones['stem'].rotation_euler.y=.045*math.sin(t*math.tau);rig.pose.bones['upper'].rotation_euler.x=.08*math.sin(t*math.tau);rig.pose.bones['lower'].rotation_euler.x=-.08*math.sin(t*math.tau)
def move(t):rig.pose.bones['stem'].rotation_euler.y=.18*math.sin(t*math.tau);rig.pose.bones['vine.L'].rotation_euler.z=.20*math.sin(t*math.tau);rig.pose.bones['vine.R'].rotation_euler.z=-.20*math.sin(t*math.tau)
def attack(t):q=math.sin(t*math.pi)**2;rig.pose.bones['upper'].rotation_euler.x=.65*q;rig.pose.bones['lower'].rotation_euler.x=-.65*q;rig.pose.bones['stem'].location.z=.12*q
def hurt(t):rig.pose.bones['stem'].rotation_euler.z=.35*math.sin(t*math.pi)*(1-t)
def death(t):q=min(1,t*1.3);rig.pose.bones['stem'].rotation_euler.z=1.35*q;rig.pose.bones['upper'].rotation_euler.x=.35*q;rig.pose.bones['lower'].rotation_euler.x=-.35*q
for n,l,pose in[('idle',49,idle),('move',31,move),('attack',19,attack),('hurt',13,hurt),('death',31,death)]:
 a=bpy.data.actions.new(n);rig.animation_data.action=a
 for f in range(1,l+1):
  for b in rig.pose.bones:b.rotation_mode='XYZ';b.rotation_euler=(0,0,0);b.location=(0,0,0);b.scale=(1,1,1)
  pose((f-1)/(l-1))
  for b in rig.pose.bones:
   for prop in('rotation_euler','location','scale'):b.keyframe_insert(prop,frame=f)
 tr=rig.animation_data.nla_tracks.new();tr.name=n;tr.strips.new(n,1,a);tr.mute=True;rig.animation_data.action=None
for b in rig.pose.bones:b.rotation_euler=(0,0,0);b.location=(0,0,0);b.scale=(1,1,1)
sc.frame_set(1);bpy.ops.wm.save_as_mainfile(filepath=str(S));[setattr(t,'mute',False)for t in rig.animation_data.nla_tracks];bpy.ops.object.select_all(action='DESELECT');mesh.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=rig;bpy.ops.export_scene.gltf(filepath=str(E),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True);[setattr(t,'mute',True)for t in rig.animation_data.nla_tracks];sc.frame_set(1)
bpy.ops.object.camera_add(location=(1.9,-3.0,1.65));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,.55))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=1.65;sc.camera=cam;sc.render.engine='BLENDER_WORKBENCH';sc.display.shading.light='STUDIO';sc.display.shading.color_type='MATERIAL';sc.display.shading.show_shadows=True;sc.display.shading.show_cavity=True;sc.display.shading.background_type='WORLD';sc.world.color=(.035,.045,.065);sc.render.resolution_x=900;sc.render.resolution_y=900;sc.render.resolution_percentage=100;sc.render.image_settings.file_format='PNG';sc.render.filepath=str(P);bpy.ops.render.render(write_still=True);print('CREATED',S,E,P)
