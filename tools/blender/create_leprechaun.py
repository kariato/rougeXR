"""Original stylized leprechaun. Blender 4.5 LTS; no external assets."""
import bpy, math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]; NAME='leprechaun'
SOURCE=ROOT/f'art/blender/creatures/{NAME}.blend'; EXPORT=ROOT/f'public/assets/creatures/{NAME}.glb'; PREVIEW=ROOT/f'art/previews/{NAME}.png'
for p in (SOURCE,EXPORT,PREVIEW): p.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False); bpy.context.preferences.filepaths.save_version=0
scene=bpy.context.scene; scene.unit_settings.system='METRIC'; scene.render.fps=24
def mat(n,c,metal=0):
 m=bpy.data.materials.new(n); m.diffuse_color=(*c,1); m.use_nodes=True; b=m.node_tree.nodes.get('Principled BSDF'); b.inputs['Base Color'].default_value=(*c,1); b.inputs['Roughness'].default_value=.75; b.inputs['Metallic'].default_value=metal; return m
green=mat('coat_green',(.055,.28,.08)); gold=mat('coin_gold',(.88,.52,.06),.75); red=mat('beard_copper',(.55,.16,.035)); skin=mat('warm_skin',(.62,.38,.22)); brown=mat('leather',(.18,.07,.025)); cream=mat('shirt',(.72,.68,.48)); black=mat('hat_boots',(.025,.03,.022)); eye=mat('eyes',(.15,.32,.48)); parts=[]
def part(n,c,s,m,b,shape='ico'):
 (bpy.ops.mesh.primitive_cube_add(size=2,location=c) if shape=='cube' else bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=c)); o=bpy.context.object; o.name=n; o.scale=s; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); o.data.materials.append(m); o.vertex_groups.new(name=b).add(list(range(len(o.data.vertices))),1,'REPLACE'); parts.append(o); return o
def cone(n,a,z,r,m,b,verts=8):
 d=Vector(z)-Vector(a); bpy.ops.mesh.primitive_cone_add(vertices=verts,radius1=r,radius2=0,depth=d.length,location=(Vector(a)+Vector(z))/2); o=bpy.context.object; o.name=n; o.rotation_euler=d.to_track_quat('Z','Y').to_euler(); bpy.ops.object.transform_apply(location=False,rotation=True,scale=True); o.data.materials.append(m); o.vertex_groups.new(name=b).add(list(range(len(o.data.vertices))),1,'REPLACE'); parts.append(o)
# Compact 1.05 m figure facing Blender -Y.
part('coat',(0,0,.55),(.20,.14,.25),green,'spine'); part('shirt',(0,-.145,.61),(.11,.025,.14),cream,'spine'); part('belt',(0,-.01,.43),(.21,.15,.035),brown,'spine','cube'); part('buckle',(0,-.17,.43),(.035,.02,.03),gold,'spine','cube')
part('head',(0,-.02,.82),(.18,.15,.17),skin,'head'); part('nose',(0,-.19,.82),(.05,.065,.05),skin,'head'); part('beard',(0,-.13,.70),(.17,.10,.14),red,'head'); cone('beard_tip',(0,-.14,.69),(0,-.13,.52),.12,red,'head')
part('hat_brim',(0,-.005,.98),(.25,.19,.035),black,'head','cube'); cone('tall_hat',(0,0,1.0),(0,.01,1.31),.17,green,'head',10); part('hat_band',(0,-.01,1.08),(.18,.15,.035),black,'head','cube'); part('hat_buckle',(0,-.165,1.08),(.035,.018,.03),gold,'head','cube')
for side,sgn in [('L',1),('R',-1)]:
 part('eye.'+side,(sgn*.07,-.158,.86),(.025,.018,.023),eye,'head'); part('ear.'+side,(sgn*.17,-.015,.83),(.04,.035,.055),skin,'head'); part('arm.'+side,(sgn*.24,0,.57),(.075,.08,.19),green,'arm.'+side); part('hand.'+side,(sgn*.25,-.015,.39),(.065,.06,.07),skin,'arm.'+side); part('leg.'+side,(sgn*.095,0,.25),(.075,.085,.17),brown,'leg.'+side); part('shoe.'+side,(sgn*.095,-.08,.075),(.10,.17,.07),black,'leg.'+side,'cube')
part('coin_pouch',(-.25,.04,.43),(.095,.07,.12),brown,'arm.R');
for i in range(3): part(f'coin.{i}',(-.25+(i-1)*.035,-.035,.44+i*.02),(.027,.012,.027),gold,'arm.R')
bpy.ops.object.select_all(action='DESELECT'); [o.select_set(True) for o in parts]; bpy.context.view_layer.objects.active=parts[0]; bpy.ops.object.join(); mesh=bpy.context.object; mesh.name=NAME+'_mesh'; scene.cursor.location=(0,0,0); bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
arm=bpy.data.armatures.new(NAME+'_skeleton'); rig=bpy.data.objects.new(NAME+'_rig',arm); scene.collection.objects.link(rig); bpy.context.view_layer.objects.active=rig; bpy.ops.object.mode_set(mode='EDIT')
def bone(n,h,t,p=None):
 b=arm.edit_bones.new(n); b.head=h; b.tail=t; b.parent=arm.edit_bones[p] if p else None
bone('root',(0,0,0),(0,0,.12)); bone('spine',(0,0,.41),(0,0,.70),'root'); bone('head',(0,0,.70),(0,0,1.15),'spine')
for side,sgn in [('L',1),('R',-1)]: bone('arm.'+side,(sgn*.19,0,.67),(sgn*.25,0,.38),'spine'); bone('leg.'+side,(sgn*.095,0,.40),(sgn*.095,-.04,.07),'root')
bpy.ops.object.mode_set(mode='OBJECT'); mesh.modifiers.new('skin','ARMATURE').object=rig; mesh.parent=rig; rig.animation_data_create()
def idle(t): rig.pose.bones['head'].rotation_euler.y=.10*math.sin(t*math.tau); rig.pose.bones['root'].location.z=.012*math.sin(t*math.tau)
def move(t):
 for side,sgn in [('L',1),('R',-1)]: rig.pose.bones['leg.'+side].rotation_euler.x=sgn*.65*math.sin(t*math.tau); rig.pose.bones['arm.'+side].rotation_euler.x=-sgn*.48*math.sin(t*math.tau)
 rig.pose.bones['root'].location.z=.07*abs(math.sin(t*math.tau))
def attack(t):
 p=math.sin(t*math.pi)**2; rig.pose.bones['arm.L'].rotation_euler.x=-1.5*p; rig.pose.bones['spine'].rotation_euler.z=.24*p; rig.pose.bones['root'].location.y=-.08*p
def hurt(t): rig.pose.bones['root'].location.x=.10*math.sin(t*math.pi)*(1-t); rig.pose.bones['head'].rotation_euler.z=.25*math.sin(t*math.pi)*(1-t)
def death(t):
 p=min(1,t*1.5); rig.pose.bones['root'].rotation_euler.z=-1.45*p; rig.pose.bones['root'].location.z=.10*p
for n,l,pose in [('idle',49,idle),('move',21,move),('attack',17,attack),('hurt',11,hurt),('death',27,death)]:
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
bpy.ops.object.camera_add(location=(1.8,-2.8,1.65)); cam=bpy.context.object; cam.rotation_euler=(Vector((0,0,.55))-cam.location).to_track_quat('-Z','Y').to_euler(); cam.data.type='ORTHO'; cam.data.ortho_scale=1.55; scene.camera=cam
scene.render.engine='BLENDER_WORKBENCH'; scene.display.shading.light='STUDIO'; scene.display.shading.color_type='MATERIAL'; scene.display.shading.show_shadows=True; scene.display.shading.show_cavity=True; scene.display.shading.background_type='WORLD'; scene.world.color=(.035,.045,.065); scene.render.resolution_x=900; scene.render.resolution_y=900; scene.render.resolution_percentage=100; scene.render.image_settings.file_format='PNG'; scene.render.filepath=str(PREVIEW); bpy.ops.render.render(write_still=True); print('CREATED',SOURCE,EXPORT,PREVIEW)
