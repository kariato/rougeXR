"""Original ancient red dragon. Blender 4.5 LTS; no external assets."""
import bpy,math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2];N='dragon';S=ROOT/f'art/blender/creatures/{N}.blend';E=ROOT/f'public/assets/creatures/{N}.glb';P=ROOT/f'art/previews/{N}.png'
for p in(S,E,P):p.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False);bpy.context.preferences.filepaths.save_version=0;sc=bpy.context.scene;sc.unit_settings.system='METRIC';sc.render.fps=24
def mat(n,c):
 m=bpy.data.materials.new(n);m.diffuse_color=(*c,1);m.use_nodes=True;m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*c,1);m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.8;return m
brown=mat('dragon_red_scales',(.46,.045,.025));cream=mat('dragon_gold_belly',(.58,.30,.07));stripe=mat('dragon_wing_membrane',(.25,.018,.025));dark=mat('dragon_horns_claws',(.10,.055,.025));eye=mat('dragon_fire_eyes',(.98,.60,.03));horn=mat('dragon_teeth',(.88,.80,.58));parts=[]
def part(n,c,s,m,b,shape='ico'):
 (bpy.ops.mesh.primitive_cube_add(size=2,location=c)if shape=='cube'else bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=c));o=bpy.context.object;o.name=n;o.scale=s;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m);o.vertex_groups.new(name=b).add(list(range(len(o.data.vertices))),1,'REPLACE');parts.append(o);return o
def cone(n,a,z,r,m,b):
 d=Vector(z)-Vector(a);bpy.ops.mesh.primitive_cone_add(vertices=7,radius1=r,radius2=0,depth=d.length,location=(Vector(a)+Vector(z))/2);o=bpy.context.object;o.name=n;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();bpy.ops.object.transform_apply(location=False,rotation=True,scale=True);o.data.materials.append(m);o.vertex_groups.new(name=b).add(list(range(len(o.data.vertices))),1,'REPLACE');parts.append(o)
# Ancient red dragon with plated chest, swept horns, broad wings and tail; faces Blender -Y.
part('body',(0,.12,.72),(.29,.55,.28),brown,'body');part('chest',(0,-.31,.79),(.27,.27,.34),cream,'body');part('neck',(0,-.42,1.04),(.19,.22,.38),cream,'neck');part('head',(0,-.61,1.25),(.18,.30,.18),brown,'head');part('long_snout',(0,-.84,1.22),(.17,.28,.14),brown,'head');part('lower_jaw',(0,-.91,1.12),(.16,.24,.08),cream,'head');cone('fang.L',(.08,-1.02,1.18),(.08,-1.04,1.08),.025,horn,'head');cone('fang.R',(-.08,-1.02,1.18),(-.08,-1.04,1.08),.025,horn,'head')
for i in range(7):cone(f'neck_spine.{i}',(0,-.24+i*.07,1.20-i*.035),(0,-.16+i*.07,1.38-i*.03),.045,stripe,'neck')
for side,sgn in [('L',1),('R',-1)]:part('eye.'+side,(sgn*.14,-.73,1.31),(.038,.025,.038),eye,'head');cone('horn.'+side,(sgn*.09,-.49,1.38),(sgn*.28,-.26,1.78),.075,dark,'head')
for key,x,y in [('front.L',.18,-.28),('front.R',-.18,-.28),('rear.L',.19,.44),('rear.R',-.19,.44)]:part('leg.'+key,(x,y,.36),(.075,.09,.34),brown if 'rear'in key else cream,'leg.'+key);part('hoof.'+key,(x,y-.06,.055),(.095,.15,.055),dark,'leg.'+key,'cube')
for i in range(6):cone(f'mane.{i}',(0,-.39+i*.09,1.22-i*.02),(0,-.30+i*.09,1.34-i*.02),.055,dark,'neck')
for i in range(5):cone(f'tail.{i}',((i-2)*.012,.64,.78),((i-2)*.025,.92,.53-i*.02),.022,dark,'body')
part('wing.L',(.42,.14,1.08),(.22,.70,.14),stripe,'body');part('wing.R',(-.42,.14,1.08),(.22,.70,.14),stripe,'body');cone('wingtip.L',(.46,.30,1.08),(1.20,.82,.92),.20,stripe,'body');cone('wingtip.R',(-.46,.30,1.08),(-1.20,.82,.92),.20,stripe,'body');cone('tail',(0,.55,.78),(0,1.42,.42),.20,brown,'body');cone('tail_tip',(0,1.30,.46),(.18,1.70,.32),.09,dark,'body')
for side,sgn in [('L',1),('R',-1)]:
 for i in range(3): cone(f'talon.{side}.{i}',(sgn*(.14+i*.04),-.39,.08),(sgn*(.14+i*.04),-.55,.035),.018,horn,'leg.front.'+side)
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
 q=math.sin(t*math.pi)**2;rig.pose.bones['body'].rotation_euler.x=-.18*q;rig.pose.bones['neck'].rotation_euler.x=-.32*q;rig.pose.bones['head'].rotation_euler.x=-.18*q;rig.pose.bones['root'].location.y=-.16*q
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
bpy.ops.object.camera_add(location=(2.3,-3.7,2.0));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,.72))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=3.0;sc.camera=cam;sc.render.engine='BLENDER_WORKBENCH';sc.display.shading.light='STUDIO';sc.display.shading.color_type='MATERIAL';sc.display.shading.show_shadows=True;sc.display.shading.show_cavity=True;sc.display.shading.background_type='WORLD';sc.world.color=(.035,.045,.065);sc.render.resolution_x=1000;sc.render.resolution_y=800;sc.render.resolution_percentage=100;sc.render.image_settings.file_format='PNG';sc.render.filepath=str(P);bpy.ops.render.render(write_still=True);print('CREATED',S,E,P)
