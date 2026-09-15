"""Original alpine yeti. Blender 4.5 LTS; no external assets."""
import bpy,math
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[2];N='yeti';S=R/f'art/blender/creatures/{N}.blend';E=R/f'public/assets/creatures/{N}.glb';P=R/f'art/previews/{N}.png'
for p in(S,E,P):p.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False);bpy.context.preferences.filepaths.save_version=0;sc=bpy.context.scene;sc.unit_settings.system='METRIC';sc.render.fps=24
def mat(n,c):
 m=bpy.data.materials.new(n);m.diffuse_color=(*c,1);m.use_nodes=True;b=m.node_tree.nodes['Principled BSDF'];b.inputs['Base Color'].default_value=(*c,1);b.inputs['Roughness'].default_value=.86;return m
fur=mat('yeti_snow_fur',(.72,.80,.80));shadow=mat('yeti_fur_shadow',(.38,.49,.52));skin=mat('yeti_blue_skin',(.20,.34,.39));dark=mat('yeti_nose_claws',(.035,.055,.06));eye=mat('yeti_ice_eyes',(.25,.85,.95));tooth=mat('yeti_teeth',(.85,.82,.67));parts=[]
def part(n,c,s,m,b,shape='ico'):
 (bpy.ops.mesh.primitive_cube_add(size=2,location=c)if shape=='cube'else bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=c));o=bpy.context.object;o.name=n;o.scale=s;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m);o.vertex_groups.new(name=b).add(list(range(len(o.data.vertices))),1,'REPLACE');parts.append(o);return o
def cone(n,a,z,r,m,b):
 d=Vector(z)-Vector(a);bpy.ops.mesh.primitive_cone_add(vertices=6,radius1=r,radius2=0,depth=d.length,location=(Vector(a)+Vector(z))/2);o=bpy.context.object;o.name=n;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();bpy.ops.object.transform_apply(location=False,rotation=True,scale=True);o.data.materials.append(m);o.vertex_groups.new(name=b).add(list(range(len(o.data.vertices))),1,'REPLACE');parts.append(o)
# Huge forward-leaning alpine primate, facing Blender -Y.
part('body',(0,.04,1.03),(.42,.27,.52),fur,'core');part('chest',(0,-.25,1.04),(.31,.055,.37),shadow,'core');part('head',(0,-.09,1.58),(.31,.25,.29),fur,'head');part('face',(0,-.29,1.52),(.23,.12,.18),skin,'head');part('muzzle',(0,-.39,1.43),(.17,.09,.10),skin,'head');part('nose',(0,-.48,1.48),(.075,.045,.05),dark,'head');part('jaw',(0,-.39,1.35),(.16,.08,.065),dark,'jaw')
for side,sgn in[('L',1),('R',-1)]:
 part('eye.'+side,(sgn*.12,-.397,1.59),(.035,.025,.032),eye,'head');part('shoulder.'+side,(sgn*.46,.01,1.21),(.22,.22,.25),fur,'arm.'+side);part('arm.'+side,(sgn*.53,-.02,.82),(.17,.18,.36),shadow,'arm.'+side);part('hand.'+side,(sgn*.55,-.15,.49),(.20,.18,.16),skin,'arm.'+side)
 for c in range(3):cone(f'claw.{side}.{c}',(sgn*(.48+c*.07),-.27,.45),(sgn*(.47+c*.08),-.40,.37),.03,dark,'arm.'+side)
 part('leg.'+side,(sgn*.22,.04,.43),(.19,.21,.33),fur,'leg.'+side);part('foot.'+side,(sgn*.23,-.14,.10),(.23,.32,.10),skin,'leg.'+side,'cube')
for i in range(5):cone(f'chin_fur.{i}',((i-2)*.055,-.35,1.35),((i-2)*.07,-.32,1.15-(i%2)*.04),.045,fur,'head')
for i in range(4):cone(f'tooth.{i}',((i-1.5)*.045,-.47,1.38),((i-1.5)*.045,-.49,1.32),.012,tooth,'jaw')
bpy.ops.object.select_all(action='DESELECT');[o.select_set(True)for o in parts];bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();mesh=bpy.context.object;mesh.name=N+'_mesh';sc.cursor.location=(0,0,0);bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
arm=bpy.data.armatures.new(N+'_skeleton');rig=bpy.data.objects.new(N+'_rig',arm);sc.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
def bone(n,h,t,p=None):b=arm.edit_bones.new(n);b.head=h;b.tail=t;b.parent=arm.edit_bones[p]if p else None
bone('root',(0,0,0),(0,0,.2));bone('core',(0,0,.62),(0,0,1.34),'root');bone('head',(0,0,1.34),(0,-.09,1.80),'core');bone('jaw',(0,-.25,1.42),(0,-.43,1.34),'head')
for side,sgn in[('L',1),('R',-1)]:bone('arm.'+side,(sgn*.35,0,1.35),(sgn*.55,-.12,.48),'core');bone('leg.'+side,(sgn*.22,0,.70),(sgn*.23,-.10,.09),'root')
bpy.ops.object.mode_set(mode='OBJECT');mesh.modifiers.new('skin','ARMATURE').object=rig;mesh.parent=rig;rig.animation_data_create()
def idle(t):rig.pose.bones['core'].scale=(1+.012*math.sin(t*math.tau),)*3;rig.pose.bones['head'].rotation_euler.y=.07*math.sin(t*math.tau)
def move(t):
 for side,sgn in[('L',1),('R',-1)]:rig.pose.bones['leg.'+side].rotation_euler.x=sgn*.42*math.sin(t*math.tau);rig.pose.bones['arm.'+side].rotation_euler.x=-sgn*.38*math.sin(t*math.tau)
 rig.pose.bones['root'].location.z=.04*abs(math.sin(t*math.tau))
def attack(t):
 q=math.sin(t*math.pi)**2;rig.pose.bones['arm.L'].rotation_euler.x=-1.55*q;rig.pose.bones['arm.R'].rotation_euler.x=-1.55*q;rig.pose.bones['jaw'].rotation_euler.x=.42*q;rig.pose.bones['root'].location.y=-.13*q
def hurt(t):rig.pose.bones['core'].rotation_euler.z=.24*math.sin(t*math.pi)*(1-t)
def death(t):q=min(1,t*1.25);rig.pose.bones['root'].rotation_euler.x=-1.38*q;rig.pose.bones['root'].location.z=.20*q
for n,l,pose in[('idle',49,idle),('move',27,move),('attack',21,attack),('hurt',13,hurt),('death',33,death)]:
 a=bpy.data.actions.new(n);rig.animation_data.action=a
 for f in range(1,l+1):
  for b in rig.pose.bones:b.rotation_mode='XYZ';b.rotation_euler=(0,0,0);b.location=(0,0,0);b.scale=(1,1,1)
  pose((f-1)/(l-1))
  for b in rig.pose.bones:
   for prop in('rotation_euler','location','scale'):b.keyframe_insert(prop,frame=f)
 tr=rig.animation_data.nla_tracks.new();tr.name=n;tr.strips.new(n,1,a);tr.mute=True;rig.animation_data.action=None
for b in rig.pose.bones:b.rotation_euler=(0,0,0);b.location=(0,0,0);b.scale=(1,1,1)
sc.frame_set(1);bpy.ops.wm.save_as_mainfile(filepath=str(S));[setattr(t,'mute',False)for t in rig.animation_data.nla_tracks];bpy.ops.object.select_all(action='DESELECT');mesh.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=rig;bpy.ops.export_scene.gltf(filepath=str(E),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True);[setattr(t,'mute',True)for t in rig.animation_data.nla_tracks];sc.frame_set(1)
bpy.ops.object.camera_add(location=(2.7,-4.2,2.55));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,.92))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=2.55;sc.camera=cam;sc.render.engine='BLENDER_WORKBENCH';sc.display.shading.light='STUDIO';sc.display.shading.color_type='MATERIAL';sc.display.shading.show_shadows=True;sc.display.shading.show_cavity=True;sc.display.shading.background_type='WORLD';sc.world.color=(.035,.045,.065);sc.render.resolution_x=900;sc.render.resolution_y=900;sc.render.resolution_percentage=100;sc.render.image_settings.file_format='PNG';sc.render.filepath=str(P);bpy.ops.render.render(write_still=True);print('CREATED',S,E,P)
