"""Original gold pickup: embossed coins and a small open pouch. Blender 4.5 LTS."""
import bpy
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[2]; N='gold'; S=R/f'art/blender/props/{N}.blend'; E=R/f'public/assets/props/{N}.glb'; P=R/f'art/previews/{N}.png'
for p in(S,E,P): p.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False); bpy.context.preferences.filepaths.save_version=0
sc=bpy.context.scene; sc.unit_settings.system='METRIC'
def mat(n,c,metal=0):
 m=bpy.data.materials.new(n); m.diffuse_color=(*c,1); m.use_nodes=True; b=m.node_tree.nodes['Principled BSDF']; b.inputs['Base Color'].default_value=(*c,1); b.inputs['Metallic'].default_value=metal; b.inputs['Roughness'].default_value=.42 if metal else .82; return m
gold=mat('coin_gold',(.86,.52,.08),.78); edge=mat('coin_engraving',(.47,.26,.025),.7); leather=mat('pouch_leather',(.22,.095,.04))
def cylinder(n,loc,r,depth,m,vertices=16):
 bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=depth,location=loc); o=bpy.context.object; o.name=n; o.data.materials.append(m); return o
def torus(n,loc,major,minor,m):
 bpy.ops.mesh.primitive_torus_add(major_segments=16,minor_segments=5,location=loc,major_radius=major,minor_radius=minor); o=bpy.context.object; o.name=n; o.data.materials.append(m); return o
# Floor-center origin; distinct tilted coins create a readable pickup silhouette.
for i,(x,y,z,a) in enumerate([(-.18,-.08,.025,.12),(-.08,.11,.034,-.17),(.09,-.12,.027,.23),(.21,.07,.031,-.25),(0,0,.069,.04)]):
 o=cylinder(f'coin_{i}',(x,y,z),.09,.016,gold); o.rotation_euler.y=a
 torus(f'coin_rim_{i}',(x,y,z+.009),.079,.003,edge)
 cylinder(f'coin_stamp_{i}',(x,y,z+.009),.025,.0015,edge,8)
bpy.ops.mesh.primitive_cone_add(vertices=12,radius1=.11,radius2=.15,depth=.14,location=(.16,.19,.085)); pouch=bpy.context.object; pouch.name='pouch'; pouch.data.materials.append(leather)
torus('pouch_rolled_lip',(.16,.19,.157),.145,.012,leather)
bpy.ops.wm.save_as_mainfile(filepath=str(S))
bpy.ops.object.select_all(action='DESELECT')
for o in sc.objects:
 if o.type=='MESH': o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(E),export_format='GLB',use_selection=True,export_animations=False)
bpy.ops.object.camera_add(location=(.8,-1.2,.9)); cam=bpy.context.object; cam.rotation_euler=(Vector((0,0,.06))-cam.location).to_track_quat('-Z','Y').to_euler(); cam.data.type='ORTHO'; cam.data.ortho_scale=.7; sc.camera=cam
sc.render.engine='BLENDER_WORKBENCH'; sc.display.shading.light='STUDIO'; sc.display.shading.color_type='MATERIAL'; sc.display.shading.show_shadows=True; sc.display.shading.show_cavity=True; sc.display.shading.background_type='WORLD'; sc.world.color=(.035,.045,.065)
sc.render.resolution_x=900; sc.render.resolution_y=700; sc.render.resolution_percentage=100; sc.render.image_settings.file_format='PNG'; sc.render.filepath=str(P); bpy.ops.render.render(write_still=True)
print('CREATED',S,E,P)
