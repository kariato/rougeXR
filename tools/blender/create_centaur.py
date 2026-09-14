"""Original armored centaur. Blender 4.5 LTS; no external assets."""
import bpy, math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]; NAME='centaur'
SOURCE=ROOT/f'art/blender/creatures/{NAME}.blend'; EXPORT=ROOT/f'public/assets/creatures/{NAME}.glb'; PREVIEW=ROOT/f'art/previews/{NAME}.png'
for p in (SOURCE,EXPORT,PREVIEW): p.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False); bpy.context.preferences.filepaths.save_version=0
scene=bpy.context.scene; scene.unit_settings.system='METRIC'; scene.render.fps=24
def mat(n,c,metal=0):
 m=bpy.data.materials.new(n); m.diffuse_color=(*c,1); m.use_nodes=True; b=m.node_tree.nodes.get('Principled BSDF'); b.inputs['Base Color'].default_value=(*c,1); b.inputs['Roughness'].default_value=.72; b.inputs['Metallic'].default_value=metal; return m
horse=mat('horse_chestnut',(.33,.13,.045)); dark=mat('mane_hooves',(.055,.025,.015)); skin=mat('warrior_skin',(.53,.32,.18)); leather=mat('leather_armor',(.20,.065,.025)); bronze=mat('bronze',(.48,.25,.07),.7); steel=mat('spear_tip',(.48,.53,.54),.8); white=mat('eyes',(.82,.75,.57)); parts=[]
def part(n,c,s,m,b,shape='ico'):
 (bpy.ops.mesh.primitive_cube_add(size=2,location=c) if shape=='cube' else bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=c)); o=bpy.context.object; o.name=n; o.scale=s; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); o.data.materials.append(m); o.vertex_groups.new(name=b).add(list(range(len(o.data.vertices))),1,'REPLACE'); parts.append(o); return o
def cone(n,a,z,r,m,b,verts=7):
 d=Vector(z)-Vector(a); bpy.ops.mesh.primitive_cone_add(vertices=verts,radius1=r,radius2=0,depth=d.length,location=(Vector(a)+Vector(z))/2); o=bpy.context.object; o.name=n; o.rotation_euler=d.to_track_quat('Z','Y').to_euler(); bpy.ops.object.transform_apply(location=False,rotation=True,scale=True); o.data.materials.append(m); o.vertex_groups.new(name=b).add(list(range(len(o.data.vertices))),1,'REPLACE'); parts.append(o)
# Horse body extends toward +Y; humanoid and head face Blender -Y.
part('horse_body',(0,.16,.72),(.31,.55,.27),horse,'body'); part('horse_chest',(0,-.24,.83),(.30,.28,.36),horse,'body'); part('human_torso',(0,-.23,1.18),(.23,.16,.33),leather,'spine'); part('breastplate',(0,-.39,1.23),(.22,.045,.25),bronze,'spine')
part('human_head',(0,-.25,1.57),(.18,.15,.19),skin,'head'); part('helmet',(0,-.22,1.70),(.19,.16,.09),bronze,'head'); cone('helmet_crest',(0,-.20,1.76),(0,-.16,1.96),.055,dark,'head'); part('nose',(0,-.41,1.57),(.05,.055,.05),skin,'head')
for side,sgn in [('L',1),('R',-1)]:
 part('eye.'+side,(sgn*.068,-.384,1.61),(.023,.016,.021),white,'head'); part('arm.'+side,(sgn*.29,-.22,1.21),(.085,.09,.25),skin,'arm.'+side); part('bracer.'+side,(sgn*.31,-.25,1.00),(.10,.10,.10),bronze,'arm.'+side); part('hand.'+side,(sgn*.31,-.27,.90),(.075,.07,.08),skin,'arm.'+side)
for key,x,y in [('front.L',.20,-.24),('front.R',-.20,-.24),('rear.L',.20,.47),('rear.R',-.20,.47)]:
 part('upper_'+key,(x,y,.45),(.105,.13,.27),horse,'leg.'+key); part('lower_'+key,(x,y-.03,.20),(.075,.085,.20),horse,'leg.'+key); part('hoof_'+key,(x,y-.10,.055),(.10,.17,.06),dark,'leg.'+key,'cube')
for i in range(5): cone(f'tail.{i}',((i-2)*.018,.66,.78),((i-2)*.035,1.00,.60-i*.025),.025,dark,'body')
# Spear follows right arm.
part('spear_shaft',(-.31,-.26,1.02),(.025,.025,.69),dark,'arm.R','cube'); cone('spear_tip',(-.31,-.26,.34),(-.31,-.27,.12),.065,steel,'arm.R')
bpy.ops.object.select_all(action='DESELECT'); [o.select_set(True) for o in parts]; bpy.context.view_layer.objects.active=parts[0]; bpy.ops.object.join(); mesh=bpy.context.object; mesh.name=NAME+'_mesh'; scene.cursor.location=(0,0,0); bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
arm=bpy.data.armatures.new(NAME+'_skeleton'); rig=bpy.data.objects.new(NAME+'_rig',arm); scene.collection.objects.link(rig); bpy.context.view_layer.objects.active=rig; bpy.ops.object.mode_set(mode='EDIT')
def bone(n,h,t,p=None):
 b=arm.edit_bones.new(n); b.head=h; b.tail=t; b.parent=arm.edit_bones[p] if p else None
bone('root',(0,0,0),(0,0,.18)); bone('body',(0,.16,.65),(0,-.15,.83),'root'); bone('spine',(0,-.20,.90),(0,-.22,1.42),'body'); bone('head',(0,-.22,1.42),(0,-.27,1.78),'spine')
for side,sgn in [('L',1),('R',-1)]: bone('arm.'+side,(sgn*.22,-.22,1.40),(sgn*.31,-.26,.89),'spine')
for key,x,y in [('front.L',.20,-.24),('front.R',-.20,-.24),('rear.L',.20,.47),('rear.R',-.20,.47)]: bone('leg.'+key,(x,y,.66),(x,y-.05,.06),'body')
bpy.ops.object.mode_set(mode='OBJECT'); mesh.modifiers.new('skin','ARMATURE').object=rig; mesh.parent=rig; rig.animation_data_create()
def idle(t): rig.pose.bones['head'].rotation_euler.y=.07*math.sin(t*math.tau); rig.pose.bones['body'].location.z=.012*math.sin(t*math.tau)
def move(t):
 for key,phase in [('front.L',0),('rear.R',0),('front.R',math.pi),('rear.L',math.pi)]: rig.pose.bones['leg.'+key].rotation_euler.x=.48*math.sin(t*math.tau+phase)
 rig.pose.bones['root'].location.z=.045*abs(math.sin(t*math.tau))
def attack(t):
 p=math.sin(t*math.pi)**2; rig.pose.bones['arm.R'].rotation_euler.x=-1.35*p; rig.pose.bones['spine'].rotation_euler.x=-.25*p; rig.pose.bones['root'].location.y=-.12*p
def hurt(t): rig.pose.bones['body'].rotation_euler.z=.22*math.sin(t*math.pi)*(1-t); rig.pose.bones['head'].rotation_euler.z=-.18*math.sin(t*math.pi)*(1-t)
def death(t):
 p=min(1,t*1.3); rig.pose.bones['root'].rotation_euler.z=1.35*p; rig.pose.bones['root'].location.z=.18*p
for n,l,pose in [('idle',49,idle),('move',25,move),('attack',21,attack),('hurt',13,hurt),('death',33,death)]:
 a=bpy.data.actions.new(n); rig.animation_data.action=a
 for f in range(1,l+1):
  for b in rig.pose.bones: b.rotation_mode='XYZ'; b.rotation_euler=(0,0,0); b.location=(0,0,0); b.scale=(1,1,1)
  pose((f-1)/(l-1))
  for b in rig.pose.bones:
   for prop in ('rotation_euler','location','scale'): b.keyframe_insert(prop,frame=f)
 tr=rig.animation_data.nla_tracks.new(); tr.name=n; tr.strips.new(n,1,a); tr.mute=True; rig.animation_data.action=None
for b in rig.pose.bones: b.rotation_euler=(0,0,0); b.location=(0,0,0); b.scale=(1,1,1)
scene.frame_set(1); bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE)); [setattr(t,'mute',False) for t in rig.animation_data.nla_tracks]; bpy.ops.object.select_all(action='DESELECT'); mesh.select_set(True); rig.select_set(True); bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(EXPORT),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True); [setattr(t,'mute',True) for t in rig.animation_data.nla_tracks]; scene.frame_set(1)
bpy.ops.object.camera_add(location=(2.6,-4.1,2.45)); cam=bpy.context.object; cam.rotation_euler=(Vector((0,.05,.88))-cam.location).to_track_quat('-Z','Y').to_euler(); cam.data.type='ORTHO'; cam.data.ortho_scale=2.45; scene.camera=cam
scene.render.engine='BLENDER_WORKBENCH'; scene.display.shading.light='STUDIO'; scene.display.shading.color_type='MATERIAL'; scene.display.shading.show_shadows=True; scene.display.shading.show_cavity=True; scene.display.shading.background_type='WORLD'; scene.world.color=(.035,.045,.065); scene.render.resolution_x=1000; scene.render.resolution_y=900; scene.render.resolution_percentage=100; scene.render.image_settings.file_format='PNG'; scene.render.filepath=str(PREVIEW); bpy.ops.render.render(write_still=True); print('CREATED',SOURCE,EXPORT,PREVIEW)
