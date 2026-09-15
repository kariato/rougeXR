"""Procedural pile of bullion bars for the gold pickup. Blender 4.5 LTS."""
import bpy, math
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[2]; N='gold'; S=R/f'art/blender/props/{N}.blend'; E=R/f'public/assets/props/{N}.glb'; P=R/f'art/previews/{N}.png'
for p in(S,E,P): p.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False); bpy.context.preferences.filepaths.save_version=0
sc=bpy.context.scene; sc.unit_settings.system='METRIC'
def mat(n,c,metal=0):
 m=bpy.data.materials.new(n); m.diffuse_color=(*c,1); m.use_nodes=True; b=m.node_tree.nodes['Principled BSDF']; b.inputs['Base Color'].default_value=(*c,1); b.inputs['Metallic'].default_value=metal; b.inputs['Roughness'].default_value=.42 if metal else .82; return m
gold=mat('bullion_top',(.95,.68,.13),.72); side=mat('bullion_side',(.69,.39,.045),.72); mark=mat('bullion_stamp',(.50,.28,.035),.72)
def bar(n,x,y,z,angle):
 # Wider bottom and sloped sides create a recognizable gold ingot.
 bx=.135;by=.065;tx=.111;ty=.049;h=.073
 def point(px,py,pz):return (x+px*math.cos(angle)-py*math.sin(angle),y+px*math.sin(angle)+py*math.cos(angle),pz)
 verts=[point(sx*bx,sy*by,z) for sx,sy in ((-1,-1),(1,-1),(1,1),(-1,1))]
 verts += [point(sx*tx,sy*ty,z+h) for sx,sy in ((-1,-1),(1,-1),(1,1),(-1,1))]
 faces=[(3,2,1,0),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
 mesh=bpy.data.meshes.new(n+'_mesh');mesh.from_pydata(verts,[],faces);mesh.update();mesh.materials.append(gold);mesh.materials.append(side)
 for face in mesh.polygons:face.material_index=0 if face.index==1 else 1
 obj=bpy.data.objects.new(n,mesh);bpy.context.collection.objects.link(obj)
 bpy.ops.mesh.primitive_cube_add(size=1,location=(x,y,z+h+.001));seal=bpy.context.object;seal.name=n+'_seal';seal.dimensions=(.046,.012,.003);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);seal.rotation_euler.z=angle;seal.data.materials.append(mark)
# Deliberately uneven placements make the stack feel spilled rather than arranged.
for i,(x,y,a) in enumerate(((-.23,-.10,-.24),(.11,-.14,.33),(-.06,.12,.18),(.27,.13,-.23),(.07,.28,.68))):bar(f'base_bar_{i}',x,y,0,a)
for i,(x,y,a) in enumerate(((-.13,-.01,.43),(.17,.025,-.31))):bar(f'upper_bar_{i}',x,y,.074,a)
bpy.ops.wm.save_as_mainfile(filepath=str(S))
bpy.ops.object.select_all(action='DESELECT')
for o in sc.objects:
 if o.type=='MESH': o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(E),export_format='GLB',use_selection=True,export_animations=False)
bpy.ops.object.camera_add(location=(.85,-1.3,.83)); cam=bpy.context.object; cam.rotation_euler=(Vector((0,0,.07))-cam.location).to_track_quat('-Z','Y').to_euler(); cam.data.type='ORTHO'; cam.data.ortho_scale=1.0; sc.camera=cam
sc.render.engine='BLENDER_WORKBENCH'; sc.display.shading.light='STUDIO'; sc.display.shading.color_type='MATERIAL'; sc.display.shading.show_shadows=True; sc.display.shading.show_cavity=True; sc.display.shading.background_type='WORLD'; sc.world.color=(.035,.045,.065)
sc.render.resolution_x=900; sc.render.resolution_y=700; sc.render.resolution_percentage=100; sc.render.image_settings.file_format='PNG'; sc.render.filepath=str(P); bpy.ops.render.render(write_still=True)
print('CREATED',S,E,P)
