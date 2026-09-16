"""Generate the complete Rogue weapon set as hand-ready GLBs. Blender 4.5 LTS."""
import bpy, math
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
NAMES=('mace','long-sword','short-bow','arrow','dagger','two-handed-sword','dart','shuriken','spear')

def mat(name,color,metal=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;b=m.node_tree.nodes['Principled BSDF'];b.inputs['Base Color'].default_value=(*color,1);b.inputs['Metallic'].default_value=metal;b.inputs['Roughness'].default_value=.38 if metal else .78;return m
def build(name):
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 for material in list(bpy.data.materials):bpy.data.materials.remove(material)
 wood=mat('dark_wood',(.25,.105,.035));leather=mat('grip_leather',(.13,.055,.025));steel=mat('polished_steel',(.52,.58,.62),.82);iron=mat('dark_iron',(.20,.23,.25),.75);feather=mat('fletching',(.55,.12,.08));parts=[]
 def cube(n,c,s,m):
  bpy.ops.mesh.primitive_cube_add(size=1,location=c);o=bpy.context.object;o.name=n;o.dimensions=s;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m);parts.append(o);return o
 def cyl(n,c,r,h,m,vertices=12):
  bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=h,location=c);o=bpy.context.object;o.name=n;o.data.materials.append(m);parts.append(o);return o
 def cone(n,a,z,r,m,vertices=10):
  d=Vector(z)-Vector(a);bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=r,radius2=0,depth=d.length,location=(Vector(a)+Vector(z))/2);o=bpy.context.object;o.name=n;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();bpy.ops.object.transform_apply(location=False,rotation=True,scale=True);o.data.materials.append(m);parts.append(o);return o
 def torus(n,c,major,minor,m,rotation=(0,0,0)):
  bpy.ops.mesh.primitive_torus_add(major_segments=20,minor_segments=6,major_radius=major,minor_radius=minor,location=c,rotation=rotation);o=bpy.context.object;o.name=n;o.data.materials.append(m);parts.append(o);return o
 if name=='mace':
  cyl('leather_grip',(0,0,.15),.035,.30,leather);cyl('mace_shaft',(0,0,.48),.025,.46,iron);bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.12,location=(0,0,.76));parts.append(bpy.context.object);parts[-1].name='flanged_mace_head';parts[-1].data.materials.append(iron)
  for i in range(6):a=i*math.tau/6;cone('mace_flange',(0,0,.76),(.15*math.sin(a),.15*math.cos(a),.76),.045,iron)
 elif name in ('long-sword','two-handed-sword','dagger'):
  length={'dagger':.48,'long-sword':.92,'two-handed-sword':1.18}[name];grip=.16 if name=='dagger' else .25 if name=='long-sword' else .38
  cyl('leather_grip',(0,0,grip/2),.032 if name=='dagger' else .04,grip,leather);cube('crossguard',(0,0,grip+.035),(.27 if name!='dagger' else .17,.045,.045),iron)
  blade_start=grip+.06;cone('tapered_blade',(0,0,blade_start),(0,0,length),.07 if name!='dagger' else .05,steel,4);cyl('pommel',(0,0,-.035),.055,.07,iron,10)
 elif name=='short-bow':
  # Three joined limbs make a readable recurved bow, with a taut string.
  for side in (-1,1):
   a=(side*.02,0,.20);b=(side*.20,0,.52);c=(side*.15,0,.84)
   for index,(p,q) in enumerate(((a,b),(b,c))):
    d=Vector(q)-Vector(p);o=cyl(f'bow_limb_{side}_{index}',(Vector(p)+Vector(q))/2,.025,d.length,wood,10);o.rotation_euler=d.to_track_quat('Z','Y').to_euler()
  cyl('bow_grip',(0,0,.20),.035,.24,leather,10);cube('bow_string',(0,.01,.52),(.012,.012,.66),steel)
 elif name in ('arrow','dart','spear'):
  length={'dart':.48,'arrow':.76,'spear':1.25}[name];shaft=.018 if name!='spear' else .028
  cyl('shaft',(0,0,length*.47),shaft,length*.82,wood,10);cone('point',(0,0,length*.88),(0,0,length),.045 if name!='spear' else .075,steel)
  if name!='spear':
   cube('fletching_x',(0,0,.06),(.10,.012,.13),feather);cube('fletching_y',(0,0,.06),(.012,.10,.13),feather)
  else:cyl('spear_grip',(0,0,.20),.038,.30,leather,10)
 elif name=='shuriken':
  for i in range(4):a=i*math.pi/2;tip=(.22*math.cos(a),.22*math.sin(a),.04);cone(f'blade_{i}',(0,0,.04),tip,.10,steel,4)
  torus('finger_ring',(0,0,.04),.045,.015,iron,rotation=(math.pi/2,0,0))
 source=ROOT/f'art/blender/weapons/{name}.blend';export=ROOT/f'public/assets/weapons/{name}.glb';preview=ROOT/f'art/previews/weapons/{name}.png'
 for p in(source,export,preview):p.parent.mkdir(parents=True,exist_ok=True)
 bpy.context.scene.unit_settings.system='METRIC';bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(source))
 bpy.ops.object.select_all(action='DESELECT');[o.select_set(True) for o in parts];bpy.context.view_layer.objects.active=parts[0];bpy.ops.export_scene.gltf(filepath=str(export),export_format='GLB',use_selection=True,export_animations=False)
 bpy.ops.object.camera_add(location=(1.4,-2.2,.85));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,.48))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=1.55;bpy.context.scene.camera=cam
 scene=bpy.context.scene;scene.render.engine='BLENDER_WORKBENCH';scene.display.shading.light='STUDIO';scene.display.shading.color_type='MATERIAL';scene.display.shading.show_shadows=True;scene.display.shading.show_cavity=True;scene.render.resolution_x=700;scene.render.resolution_y=700;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.filepath=str(preview);bpy.ops.render.render(write_still=True)
 print('CREATED',name,export)

for weapon in NAMES:build(weapon)
