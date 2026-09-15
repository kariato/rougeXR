"""Original treasure-disguised xeroc. Blender 4.5 LTS; no external assets."""
import bpy,math
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[2];N='xeroc';S=R/f'art/blender/creatures/{N}.blend';E=R/f'public/assets/creatures/{N}.glb';P=R/f'art/previews/{N}.png'
for p in(S,E,P):p.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False);bpy.context.preferences.filepaths.save_version=0;sc=bpy.context.scene;sc.unit_settings.system='METRIC';sc.render.fps=24
def mat(n,c,metal=0):
 m=bpy.data.materials.new(n);m.diffuse_color=(*c,1);m.use_nodes=True;b=m.node_tree.nodes['Principled BSDF'];b.inputs['Base Color'].default_value=(*c,1);b.inputs['Roughness'].default_value=.72;b.inputs['Metallic'].default_value=metal;return m
wood=mat('xeroc_chest_wood',(.30,.12,.035));darkwood=mat('xeroc_dark_wood',(.12,.045,.018));iron=mat('xeroc_bands',(.22,.25,.25),.7);mouth=mat('xeroc_mouth',(.30,.025,.04));tooth=mat('xeroc_teeth',(.78,.72,.52));eye=mat('xeroc_eye',(.88,.56,.06));tongue=mat('xeroc_tongue',(.48,.055,.12));parts=[]
def part(n,c,s,m,b,shape='cube'):
 (bpy.ops.mesh.primitive_cube_add(size=2,location=c)if shape=='cube'else bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=c));o=bpy.context.object;o.name=n;o.scale=s;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m);o.vertex_groups.new(name=b).add(list(range(len(o.data.vertices))),1,'REPLACE');parts.append(o);return o
def cone(n,a,z,r,m,b):
 d=Vector(z)-Vector(a);bpy.ops.mesh.primitive_cone_add(vertices=6,radius1=r,radius2=0,depth=d.length,location=(Vector(a)+Vector(z))/2);o=bpy.context.object;o.name=n;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();bpy.ops.object.transform_apply(location=False,rotation=True,scale=True);o.data.materials.append(m);o.vertex_groups.new(name=b).add(list(range(len(o.data.vertices))),1,'REPLACE');parts.append(o)
# Mimic-like object monster masquerading as a treasure chest, front at Blender -Y.
part('chest_base',(0,0,.33),(.42,.30,.28),wood,'base');part('mouth',(0,-.31,.49),(.35,.035,.10),mouth,'base');part('lid',(0,.01,.69),(.44,.31,.16),darkwood,'lid');part('lid_front',(0,-.29,.68),(.40,.035,.13),wood,'lid')
for x in(-.30,0,.30):part('band'+str(x),(x,-.315,.42),(.035,.018,.27),iron,'base');part('lid_band'+str(x),(x,-.33,.69),(.035,.018,.14),iron,'lid')
part('lock',(0,-.36,.60),(.085,.035,.10),iron,'lid');part('eye.L',(.18,-.355,.71),(.045,.025,.04),eye,'lid','ico');part('eye.R',(-.18,-.355,.71),(.045,.025,.04),eye,'lid','ico')
for side,sgn in[('L',1),('R',-1)]:
 for i in range(5):x=sgn*(.035+i*.07);cone(f'tooth.{side}.{i}',(x,-.36,.55),(x,-.42,.47),.018,tooth,'lid');cone(f'lower.{side}.{i}',(x,-.36,.43),(x,-.42,.51),.018,tooth,'base')
 cone('leg.'+side,(sgn*.28,.10,.18),(sgn*.42,-.02,.04),.07,darkwood,'leg.'+side);part('foot.'+side,(sgn*.45,-.06,.045),(.13,.15,.045),iron,'leg.'+side)
cone('tongue',(0,-.36,.46),(0,-.72,.34),.055,tongue,'tongue');cone('tongue_tip',(0,-.68,.35),(.13,-.82,.31),.035,tongue,'tongue')
bpy.ops.object.select_all(action='DESELECT');[o.select_set(True)for o in parts];bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();mesh=bpy.context.object;mesh.name=N+'_mesh';sc.cursor.location=(0,0,0);bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
arm=bpy.data.armatures.new(N+'_skeleton');rig=bpy.data.objects.new(N+'_rig',arm);sc.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
def bn(n,h,t,p=None):b=arm.edit_bones.new(n);b.head=h;b.tail=t;b.parent=arm.edit_bones[p]if p else None
bn('root',(0,0,0),(0,0,.12));bn('base',(0,0,.15),(0,0,.50),'root');bn('lid',(0,.15,.56),(0,-.15,.75),'base');bn('tongue',(0,-.30,.46),(0,-.72,.34),'base');bn('leg.L',(.25,.10,.20),(.45,-.05,.04),'base');bn('leg.R',(-.25,.10,.20),(-.45,-.05,.04),'base')
bpy.ops.object.mode_set(mode='OBJECT');mesh.modifiers.new('skin','ARMATURE').object=rig;mesh.parent=rig;rig.animation_data_create()
def idle(t):rig.pose.bones['lid'].rotation_euler.x=.035*math.sin(t*math.tau);rig.pose.bones['tongue'].scale.y=.75+.25*math.cos(t*math.tau)
def move(t):
 for side,sgn in[('L',1),('R',-1)]:rig.pose.bones['leg.'+side].rotation_euler.x=sgn*.55*math.sin(t*math.tau)
 rig.pose.bones['root'].location.z=.06*abs(math.sin(t*math.tau))
def attack(t):q=math.sin(t*math.pi)**2;rig.pose.bones['lid'].rotation_euler.x=-1.0*q;rig.pose.bones['tongue'].scale.y=1+1.0*q;rig.pose.bones['root'].location.y=-.08*q
def hurt(t):rig.pose.bones['base'].rotation_euler.z=.30*math.sin(t*math.pi)*(1-t)
def death(t):q=min(1,t*1.4);rig.pose.bones['root'].rotation_euler.z=1.25*q;rig.pose.bones['lid'].rotation_euler.x=-.65*q
for n,l,pose in[('idle',49,idle),('move',23,move),('attack',19,attack),('hurt',11,hurt),('death',29,death)]:
 a=bpy.data.actions.new(n);rig.animation_data.action=a
 for f in range(1,l+1):
  for b in rig.pose.bones:b.rotation_mode='XYZ';b.rotation_euler=(0,0,0);b.location=(0,0,0);b.scale=(1,1,1)
  pose((f-1)/(l-1))
  for b in rig.pose.bones:
   for prop in('rotation_euler','location','scale'):b.keyframe_insert(prop,frame=f)
 tr=rig.animation_data.nla_tracks.new();tr.name=n;tr.strips.new(n,1,a);tr.mute=True;rig.animation_data.action=None
for b in rig.pose.bones:b.rotation_euler=(0,0,0);b.location=(0,0,0);b.scale=(1,1,1)
sc.frame_set(1);bpy.ops.wm.save_as_mainfile(filepath=str(S));[setattr(t,'mute',False)for t in rig.animation_data.nla_tracks];bpy.ops.object.select_all(action='DESELECT');mesh.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=rig;bpy.ops.export_scene.gltf(filepath=str(E),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True);[setattr(t,'mute',True)for t in rig.animation_data.nla_tracks];sc.frame_set(1)
bpy.ops.object.camera_add(location=(1.8,-2.8,1.45));cam=bpy.context.object;cam.rotation_euler=(Vector((0,-.05,.40))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=1.45;sc.camera=cam;sc.render.engine='BLENDER_WORKBENCH';sc.display.shading.light='STUDIO';sc.display.shading.color_type='MATERIAL';sc.display.shading.show_shadows=True;sc.display.shading.show_cavity=True;sc.display.shading.background_type='WORLD';sc.world.color=(.035,.045,.065);sc.render.resolution_x=900;sc.render.resolution_y=800;sc.render.resolution_percentage=100;sc.render.image_settings.file_format='PNG';sc.render.filepath=str(P);bpy.ops.render.render(write_still=True);print('CREATED',S,E,P)
