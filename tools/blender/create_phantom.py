"""Original armored phantom. Blender 4.5 LTS; no external assets."""
import bpy,math
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[2];N='phantom';S=R/f'art/blender/creatures/{N}.blend';E=R/f'public/assets/creatures/{N}.glb';P=R/f'art/previews/{N}.png'
for p in(S,E,P):p.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False);bpy.context.preferences.filepaths.save_version=0;sc=bpy.context.scene;sc.unit_settings.system='METRIC';sc.render.fps=24
def mat(n,c):
 m=bpy.data.materials.new(n);m.diffuse_color=(*c,1);m.use_nodes=True;b=m.node_tree.nodes['Principled BSDF'];b.inputs['Base Color'].default_value=(*c,1);b.inputs['Roughness'].default_value=.62;return m
cloak=mat('phantom_cloak',(.14,.11,.20));edge=mat('phantom_armor',(.36,.32,.48));void=mat('phantom_void',(.010,.006,.020));glow=mat('phantom_glow',(.72,.26,.92));bone=mat('phantom_blades',(.55,.50,.64));parts=[]
def part(n,c,s,m,b,shape='ico'):
 (bpy.ops.mesh.primitive_cube_add(size=2,location=c)if shape=='cube'else bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=c));o=bpy.context.object;o.name=n;o.scale=s;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m);o.vertex_groups.new(name=b).add(list(range(len(o.data.vertices))),1,'REPLACE');parts.append(o);return o
def cone(n,a,z,r,m,b):
 d=Vector(z)-Vector(a);bpy.ops.mesh.primitive_cone_add(vertices=7,radius1=r,radius2=0,depth=d.length,location=(Vector(a)+Vector(z))/2);o=bpy.context.object;o.name=n;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();bpy.ops.object.transform_apply(location=False,rotation=True,scale=True);o.data.materials.append(m);o.vertex_groups.new(name=b).add(list(range(len(o.data.vertices))),1,'REPLACE');parts.append(o)
# Hovering armored apparition, facing Blender -Y.
cone('torn_cloak',(0,.03,1.16),(0,.03,.22),.43,cloak,'core');part('shoulders',(0,0,1.23),(.42,.20,.20),cloak,'core');part('hood',(0,-.02,1.55),(.29,.23,.32),cloak,'head');part('face_void',(0,-.23,1.52),(.18,.045,.20),void,'head');part('soul.L',(.07,-.27,1.58),(.027,.018,.035),glow,'head');part('soul.R',(-.07,-.27,1.58),(.027,.018,.035),glow,'head')
for side,sgn in[('L',1),('R',-1)]:
 cone('sleeve.'+side,(sgn*.30,0,1.26),(sgn*.60,-.13,.83),.15,cloak,'arm.'+side);part('hand.'+side,(sgn*.61,-.15,.79),(.085,.075,.10),bone,'arm.'+side)
 for i in range(3):cone(f'finger.{side}.{i}',(sgn*(.57+i*.035),-.20,.76),(sgn*(.56+i*.045),-.34,.68-i*.015),.014,bone,'arm.'+side)
for i in range(5):
 x=(i-2)*.13;cone(f'tatter.{i}',(x,.03,.58),(x*1.25,.05,.12+(i%2)*.10),.09,edge,'tail.L' if i<2 else 'tail.R')
part('mask',(0,-.28,1.52),(.13,.025,.16),edge,'head');cone('mask_beak',(0,-.30,1.51),(0,-.47,1.42),.07,bone,'head')
for side,sgn in [('L',1),('R',-1)]: cone('shoulder_spike.'+side,(sgn*.31,0,1.31),(sgn*.53,.02,1.48),.08,edge,'core')
bpy.ops.object.select_all(action='DESELECT');[o.select_set(True)for o in parts];bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();mesh=bpy.context.object;mesh.name=N+'_mesh';sc.cursor.location=(0,0,0);bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
arm=bpy.data.armatures.new(N+'_skeleton');rig=bpy.data.objects.new(N+'_rig',arm);sc.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
def bn(n,h,t,p=None):b=arm.edit_bones.new(n);b.head=h;b.tail=t;b.parent=arm.edit_bones[p]if p else None
bn('root',(0,0,0),(0,0,.15));bn('core',(0,0,.55),(0,0,1.35),'root');bn('head',(0,0,1.30),(0,-.03,1.78),'core');bn('arm.L',(.28,0,1.28),(.61,-.14,.78),'core');bn('arm.R',(-.28,0,1.28),(-.61,-.14,.78),'core');bn('tail.L',(-.10,0,.62),(-.24,.02,.16),'core');bn('tail.R',(.10,0,.62),(.24,.02,.16),'core')
bpy.ops.object.mode_set(mode='OBJECT');mesh.modifiers.new('skin','ARMATURE').object=rig;mesh.parent=rig;rig.animation_data_create()
def idle(t):rig.pose.bones['root'].location.z=.05*math.sin(t*math.tau);rig.pose.bones['head'].rotation_euler.y=.08*math.sin(t*math.tau);rig.pose.bones['tail.L'].rotation_euler.z=.08*math.sin(t*math.tau);rig.pose.bones['tail.R'].rotation_euler.z=-.08*math.sin(t*math.tau)
def move(t):rig.pose.bones['root'].location.z=.08*math.sin(t*math.tau);rig.pose.bones['core'].rotation_euler.z=.12*math.sin(t*math.tau);rig.pose.bones['arm.L'].rotation_euler.x=-.25;rig.pose.bones['arm.R'].rotation_euler.x=-.25
def attack(t):q=math.sin(t*math.pi)**2;rig.pose.bones['arm.L'].rotation_euler.x=-1.4*q;rig.pose.bones['arm.R'].rotation_euler.x=-1.4*q;rig.pose.bones['root'].location.y=-.18*q
def hurt(t):rig.pose.bones['core'].rotation_euler.z=.35*math.sin(t*math.pi)*(1-t);rig.pose.bones['root'].location.z=.10*math.sin(t*math.pi)*(1-t)
def death(t):q=min(1,t*1.25);rig.pose.bones['root'].location.z=-.65*q;rig.pose.bones['core'].scale=(1-.45*q,1-.45*q,1-.55*q)
for n,l,pose in[('idle',49,idle),('move',31,move),('attack',21,attack),('hurt',13,hurt),('death',33,death)]:
 a=bpy.data.actions.new(n);rig.animation_data.action=a
 for f in range(1,l+1):
  for b in rig.pose.bones:b.rotation_mode='XYZ';b.rotation_euler=(0,0,0);b.location=(0,0,0);b.scale=(1,1,1)
  pose((f-1)/(l-1))
  for b in rig.pose.bones:
   for prop in('rotation_euler','location','scale'):b.keyframe_insert(prop,frame=f)
 tr=rig.animation_data.nla_tracks.new();tr.name=n;tr.strips.new(n,1,a);tr.mute=True;rig.animation_data.action=None
for b in rig.pose.bones:b.rotation_euler=(0,0,0);b.location=(0,0,0);b.scale=(1,1,1)
sc.frame_set(1);bpy.ops.wm.save_as_mainfile(filepath=str(S));[setattr(t,'mute',False)for t in rig.animation_data.nla_tracks];bpy.ops.object.select_all(action='DESELECT');mesh.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=rig;bpy.ops.export_scene.gltf(filepath=str(E),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True);[setattr(t,'mute',True)for t in rig.animation_data.nla_tracks];sc.frame_set(1)
bpy.ops.object.camera_add(location=(2.2,-3.4,2.2));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,.90))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=2.15;sc.camera=cam;sc.render.engine='BLENDER_WORKBENCH';sc.display.shading.light='STUDIO';sc.display.shading.color_type='MATERIAL';sc.display.shading.show_shadows=True;sc.display.shading.show_cavity=True;sc.display.shading.background_type='WORLD';sc.world.color=(.02,.025,.045);sc.render.resolution_x=900;sc.render.resolution_y=900;sc.render.resolution_percentage=100;sc.render.image_settings.file_format='PNG';sc.render.filepath=str(P);bpy.ops.render.render(write_still=True);print('CREATED',S,E,P)
