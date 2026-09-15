"""Original potion pickup with glass bottle, stopper and colored liquid. Blender 4.5 LTS."""
import bpy
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[2];N='potion';S=R/f'art/blender/props/{N}.blend';E=R/f'public/assets/props/{N}.glb';P=R/f'art/previews/{N}.png'
for p in(S,E,P):p.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False);bpy.context.preferences.filepaths.save_version=0;sc=bpy.context.scene;sc.unit_settings.system='METRIC'
def mat(n,c,metal=0,rough=.35):
 m=bpy.data.materials.new(n);m.diffuse_color=(*c,1);m.use_nodes=True;b=m.node_tree.nodes['Principled BSDF'];b.inputs['Base Color'].default_value=(*c,1);b.inputs['Metallic'].default_value=metal;b.inputs['Roughness'].default_value=rough;return m
glass=mat('blue_glass',(.27,.62,.69),rough=.12);liquid=mat('violet_liquid',(.42,.08,.72),rough=.17);cork=mat('cork',(.52,.31,.12),rough=.9);band=mat('brass_band',(.69,.46,.09),metal=.7);wax=mat('seal_wax',(.60,.07,.09),rough=.8)
def cyl(n,z,r1,r2,h,m):
 bpy.ops.mesh.primitive_cone_add(vertices=16,radius1=r1,radius2=r2,depth=h,location=(0,0,z));o=bpy.context.object;o.name=n;o.data.materials.append(m)
def tor(n,z,r,m):
 bpy.ops.mesh.primitive_torus_add(major_segments=16,minor_segments=6,location=(0,0,z),major_radius=r,minor_radius=.008);o=bpy.context.object;o.name=n;o.data.materials.append(m)
cyl('glass_base',.12,.105,.12,.22,glass);cyl('liquid_fill',.105,.082,.088,.15,liquid);cyl('glass_shoulder',.28,.12,.055,.10,glass);cyl('glass_neck',.39,.045,.045,.16,glass);cyl('cork_stopper',.49,.05,.055,.07,cork);tor('lip',.455,.05,band);tor('lower_band',.045,.106,band)
bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,radius=.025,location=(0,-.112,.24));o=bpy.context.object;o.name='wax_seal';o.data.materials.append(wax)
bpy.ops.wm.save_as_mainfile(filepath=str(S));bpy.ops.object.select_all(action='DESELECT')
for o in sc.objects:
 if o.type=='MESH':o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(E),export_format='GLB',use_selection=True,export_animations=False)
bpy.ops.object.camera_add(location=(.65,-1.1,.75));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,.25))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=.65;sc.camera=cam
sc.render.engine='BLENDER_WORKBENCH';sc.display.shading.light='STUDIO';sc.display.shading.color_type='MATERIAL';sc.display.shading.show_shadows=True;sc.display.shading.show_cavity=True;sc.display.shading.background_type='WORLD';sc.world.color=(.035,.045,.065);sc.render.resolution_x=800;sc.render.resolution_y=800;sc.render.resolution_percentage=100;sc.render.image_settings.file_format='PNG';sc.render.filepath=str(P);bpy.ops.render.render(write_still=True);print('CREATED',S,E,P)
