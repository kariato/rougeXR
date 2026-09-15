"""Original stylized quagga. Blender 4.5 LTS; no external assets."""
import bpy,math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2];N='quagga';S=ROOT/f'art/blender/creatures/{N}.blend';E=ROOT/f'public/assets/creatures/{N}.glb';P=ROOT/f'art/previews/{N}.png'
for p in(S,E,P):p.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False);bpy.context.preferences.filepaths.save_version=0;sc=bpy.context.scene;sc.unit_settings.system='METRIC';sc.render.fps=24
def mat(n,c):
 m=bpy.data.materials.new(n);m.diffuse_color=(*c,1);m.use_nodes=True;m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*c,1);m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.8;return m
brown=mat('quagga_chestnut',(.38,.19,.075));cream=mat('quagga_cream',(.67,.52,.30));stripe=mat('quagga_stripes',(.08,.045,.025));dark=mat('mane_hooves',(.035,.022,.014));eye=mat('eyes',(.72,.45,.12));parts=[]
def part(n,c,s,m,b,shape='ico'):
 (bpy.ops.mesh.primitive_cube_add(size=2,location=c)if shape=='cube'else bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=c));o=bpy.context.object;o.name=n;o.scale=s;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m);o.vertex_groups.new(name=b).add(list(range(len(o.data.vertices))),1,'REPLACE');parts.append(o);return o
def cone(n,a,z,r,m,b):
 d=Vector(z)-Vector(a);bpy.ops.mesh.primitive_cone_add(vertices=7,radius1=r,radius2=0,depth=d.length,location=(Vector(a)+Vector(z))/2);o=bpy.context.object;o.name=n;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();bpy.ops.object.transform_apply(location=False,rotation=True,scale=True);o.data.materials.append(m);o.vertex_groups.new(name=b).add(list(range(len(o.data.vertices))),1,'REPLACE');parts.append(o)
# Extinct zebra relative: striped forequarters fade into a brown rump; faces Blender -Y.
part('body',(0,.12,.72),(.29,.55,.28),brown,'body');part('chest',(0,-.31,.79),(.27,.27,.34),cream,'body');part('neck',(0,-.42,1.04),(.19,.22,.38),cream,'neck');part('head',(0,-.61,1.25),(.18,.30,.18),brown,'head');part('muzzle',(0,-.86,1.18),(.15,.16,.11),dark,'head')
for i in range(6):part(f'stripe.{i}',(0,-.39+i*.09,.91-i*.025),(.285,.025,.30-i*.018),stripe,'body')
for side,sgn in [('L',1),('R',-1)]:part('eye.'+side,(sgn*.14,-.73,1.31),(.025,.025,.025),eye,'head');cone('ear.'+side,(sgn*.09,-.49,1.38),(sgn*.12,-.47,1.58),.055,dark,'head')
for key,x,y in [('front.L',.18,-.28),('front.R',-.18,-.28),('rear.L',.19,.44),('rear.R',-.19,.44)]:part('leg.'+key,(x,y,.36),(.075,.09,.34),brown if 'rear'in key else cream,'leg.'+key);part('hoof.'+key,(x,y-.06,.055),(.095,.15,.055),dark,'leg.'+key,'cube')
for i in range(6):cone(f'mane.{i}',(0,-.39+i*.09,1.22-i*.02),(0,-.30+i*.09,1.34-i*.02),.055,dark,'neck')
for i in range(5):cone(f'tail.{i}',((i-2)*.012,.64,.78),((i-2)*.025,.92,.53-i*.02),.022,dark,'body')
bpy.ops.object.select_all(action='DESELECT');[o.select_set(True)for o in parts];bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();mesh=bpy.context.object;mesh.name=N+'_mesh';sc.cursor.location=(0,0,0);bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
arm=bpy.data.armatures.new(N+'_skeleton');rig=bpy.data.objects.new(N+'_rig',arm);sc.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
def bone(n,h,t,p=None):
 b=arm.edit_bones.new(n);b.head=h;b.tail=t;b.parent=arm.edit_bones[p]if p else None
bone('root',(0,0,0),(0,0,.15));bone('body',(0,.12,.68),(0,-.22,.78),'root');bone('neck',(0,-.25,.82),(0,-.48,1.25),'body');bone('head',(0,-.48,1.20),(0,-.82,1.20),'neck')
for k,x,y in [('front.L',.18,-.28),('front.R',-.18,-.28),('rear.L',.19,.44),('rear.R',-.19,.44)]:bone('leg.'+k,(x,y,.65),(x,y-.04,.05),'body')
bpy.ops.object.mode_set(mode='OBJECT');mesh.modifiers.new('skin','ARMATURE').object=rig;mesh.parent=rig;rig.animation_data_create()
def idle(t):rig.pose.bones['head'].rotation_euler.z=.08*math.sin(t*math.tau);rig.pose.bones['neck'].rotation_euler.x=.035*math.sin(t*math.tau)
def move(t):
 for k,p in [('front.L',0),('rear.R',0),('front.R',math.pi),('rear.L',math.pi)]:rig.pose.bones['leg.'+k].rotation_euler.x=.55*math.sin(t*math.tau+p)
 rig.pose.bones['root'].location.z=.045*abs(math.sin(t*math.tau))
def attack(t):
 q=math.sin(t*math.pi)**2;rig.pose.bones['body'].rotation_euler.x=.18*q;rig.pose.bones['leg.rear.L'].rotation_euler.x=-1.1*q;rig.pose.bones['leg.rear.R'].rotation_euler.x=-1.1*q
def hurt(t):rig.pose.bones['body'].rotation_euler.z=.25*math.sin(t*math.pi)*(1-t)
def death(t):q=min(1,t*1.3);rig.pose.bones['root'].rotation_euler.z=1.35*q;rig.pose.bones['root'].location.z=.16*q
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
bpy.ops.object.camera_add(location=(2.3,-3.7,2.0));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,.72))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=2.2;sc.camera=cam;sc.render.engine='BLENDER_WORKBENCH';sc.display.shading.light='STUDIO';sc.display.shading.color_type='MATERIAL';sc.display.shading.show_shadows=True;sc.display.shading.show_cavity=True;sc.display.shading.background_type='WORLD';sc.world.color=(.035,.045,.065);sc.render.resolution_x=1000;sc.render.resolution_y=800;sc.render.resolution_percentage=100;sc.render.image_settings.file_format='PNG';sc.render.filepath=str(P);bpy.ops.render.render(write_still=True);print('CREATED',S,E,P)
