"""Assemble generated prop components, bake textures, and author rigid hinges."""
from pathlib import Path
import argparse, hashlib, importlib.util, json, math, time
import bpy,bmesh
import numpy as np
from mathutils import Matrix,Vector
ROOT=Path(__file__).resolve().parents[2]; OUT=ROOT/'out/props-v1'
CATALOG=json.loads((ROOT/'art/prop-references/hunyuan-v1/prompts.json').read_text())
spec=importlib.util.spec_from_file_location('render_helpers',ROOT/'tools/monsters/animate_meshes.py')
helper=importlib.util.module_from_spec(spec);spec.loader.exec_module(helper)
SIZES={'door-leaf':(.94,.10,1.96),'door-frame':(1.45,.34,2.3),'chest-base':(1,.68,.50),'chest-lid':(1.02,.70,.24),
       'torch':(.20,.20,.72),'urn':(.50,.50,.70),'pillar':(.60,.60,2.2),'potion':(.17,.17,.23)}
def digest(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def import_part(identity):
 before=set(bpy.context.scene.objects)
 bpy.ops.import_scene.gltf(filepath=str(OUT/'parts'/identity/'candidate.glb'))
 imported=set(bpy.context.scene.objects)-before
 obj=next(o for o in imported if o.type=='MESH')
 world=helper.points(obj)
 obj.parent=None;obj.matrix_world=Matrix.Identity(4)
 lo,hi=world.min(axis=0),world.max(axis=0)
 scaled=(world-[(lo[0]+hi[0])/2,(lo[1]+hi[1])/2,lo[2]])*np.array(SIZES[identity])/(hi-lo)
 if identity=='door-leaf': scaled[:,2]+=.02
 if identity=='chest-lid': scaled[:,2]+=.46
 for vertex,point in zip(obj.data.vertices,scaled): vertex.co=point
 obj.name=identity.replace('-','_')
 bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.remove_doubles(threshold=.000001)
 bpy.ops.object.mode_set(mode='OBJECT')
 for extra in imported:
  if extra!=obj: bpy.data.objects.remove(extra,do_unlink=True)
 return obj

def level_chest_rim(obj):
 # Correct the perspective-shaped top edge of the reconstructed box, retaining
 # its generated walls and texture instead of leaving a gap beneath the lid.
 from mathutils.kdtree import KDTree
 points=np.array([tuple(v.co) for v in obj.data.vertices])
 upper=points[points[:,2]>.22]
 tree=KDTree(len(upper))
 for i,p in enumerate(upper):tree.insert(Vector((p[0],p[1],0)),i)
 tree.balance()
 for vertex in obj.data.vertices:
  x,y,z=vertex.co
  if abs(x)<.35 and abs(y)<.22:continue
  near=tree.find_n(Vector((x,y,0)),min(16,len(upper)))
  local_top=max(upper[index,2] for _,index,_ in near)
  if local_top>.25:vertex.co.z=.5 if z>local_top-.025 else z*.5/local_top

def seal_surface(obj):
 bm=bmesh.new();bm.from_mesh(obj.data)
 boundary=[edge for edge in bm.edges if edge.is_boundary]
 if boundary:bmesh.ops.holes_fill(bm,edges=boundary,sides=0)
 bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
 if bm.calc_volume(signed=True)<0:bmesh.ops.reverse_faces(bm,faces=list(bm.faces))
 remaining=sum(not edge.is_manifold for edge in bm.edges)
 bm.to_mesh(obj.data);bm.free();obj.data.update();bpy.context.view_layer.update()
 if remaining:
  # Some reconstructed box walls meet along non-manifold marching-cubes edges.
  # Rebuild just this solid before cutting; its frontal UVs are restored below.
  bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
  remesh=obj.modifiers.new('Repair reconstructed solid','REMESH');remesh.mode='VOXEL';remesh.voxel_size=.009;remesh.use_smooth_shade=True
  bpy.ops.object.modifier_apply(modifier=remesh.name)
  obj.data.calc_loop_triangles();count=len(obj.data.loop_triangles)
  if count>2200:
   decimate=obj.modifiers.new('Prop triangle budget','DECIMATE');decimate.ratio=2200/count
   bpy.ops.object.modifier_apply(modifier=decimate.name)
  obj.data.update();bpy.context.view_layer.update()
  print('Repaired non-manifold solid using voxel remesh',flush=True)

def subtract_box(obj,dimensions,center):
 seal_surface(obj)
 bpy.ops.mesh.primitive_cube_add(size=1,location=center);cutter=bpy.context.object;cutter.dimensions=dimensions
 bpy.context.view_layer.objects.active=cutter;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 bpy.context.view_layer.objects.active=obj
 modifier=obj.modifiers.new('Functional clearance','BOOLEAN');modifier.operation='DIFFERENCE';modifier.solver='EXACT';modifier.object=cutter
 bpy.ops.object.modifier_apply(modifier=modifier.name);bpy.data.objects.remove(cutter,do_unlink=True)
 if not len(obj.data.polygons): raise ValueError('Clearance cut removed the object')

def chest_front_texture(obj):
 atlas=OUT/'chest-front-atlas.png';meta=json.loads((OUT/'chest-front-atlas.json').read_text())
 lo=np.min([tuple(v.co) for v in obj.data.vertices],axis=0);hi=np.max([tuple(v.co) for v in obj.data.vertices],axis=0)
 x0,y0,x1,y1=meta['bounds'];layer=obj.data.uv_layers.active or obj.data.uv_layers.new(name='ReferenceUV')
 for loop in obj.data.loops:
  point=obj.data.vertices[loop.vertex_index].co
  u=(x0+(point.x-lo[0])/(hi[0]-lo[0])*(x1-x0))/meta['width']
  v=1-(y1-(point.z-lo[2])/(hi[2]-lo[2])*(y1-y0))/meta['height']
  layer.data[loop.index].uv=(u*.75,v)
 image=bpy.data.images.load(str(atlas),check_existing=True)
 for node in obj.data.materials[0].node_tree.nodes:
  if node.type=='TEX_IMAGE':node.image=image

def bake(obj,directory):
 bpy.context.view_layer.objects.active=obj;bpy.ops.object.select_all(action='DESELECT');obj.select_set(True)
 # Save UV values before adding layers: Blender 5 invalidates cached UV references.
 old=[tuple(uv.uv) for uv in obj.data.uv_layers.active.data]
 obj.data.uv_layers.new(name='ReferenceFront');obj.data.uv_layers.new(name='ReferenceBack')
 for index,(u,v) in enumerate(old):
  source=(u-.75)/.25 if u>.75 else u/.75
  obj.data.uv_layers['ReferenceFront'].data[index].uv=(source*.75,v)
  obj.data.uv_layers['ReferenceBack'].data[index].uv=(.75+source*.25,v)
 material=obj.data.materials[0];nodes=material.node_tree.nodes;links=material.node_tree.links
 source=next(n.image for n in nodes if n.type=='TEX_IMAGE');nodes.clear()
 output=nodes.new('ShaderNodeOutputMaterial');shader=nodes.new('ShaderNodeBsdfPrincipled');shader.inputs['Roughness'].default_value=.82
 links.new(shader.outputs['BSDF'],output.inputs['Surface']);textures=[]
 for name in ['ReferenceBack','ReferenceFront']:
  uv=nodes.new('ShaderNodeUVMap');uv.uv_map=name
  texture=nodes.new('ShaderNodeTexImage');texture.image=source;links.new(uv.outputs['UV'],texture.inputs['Vector']);textures.append(texture)
 geometry=nodes.new('ShaderNodeNewGeometry');dot=nodes.new('ShaderNodeVectorMath');dot.operation='DOT_PRODUCT';dot.inputs[1].default_value=(0,-1,0)
 links.new(geometry.outputs['Normal'],dot.inputs[0]);factor=nodes.new('ShaderNodeMapRange');factor.clamp=True
 factor.inputs['From Min'].default_value=-.25;factor.inputs['From Max'].default_value=.5;links.new(dot.outputs['Value'],factor.inputs['Value'])
 mix=nodes.new('ShaderNodeMixRGB');links.new(factor.outputs['Result'],mix.inputs[0])
 links.new(textures[0].outputs['Color'],mix.inputs[1]);links.new(textures[1].outputs['Color'],mix.inputs[2]);links.new(mix.outputs['Color'],shader.inputs['Base Color'])
 layer=obj.data.uv_layers.new(name='BakedUV');obj.data.uv_layers.active=layer;layer.active_render=True
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.remove_doubles(threshold=.000001)
 bpy.ops.mesh.dissolve_degenerate(threshold=.000001)
 bpy.ops.mesh.quads_convert_to_tris(quad_method='BEAUTY',ngon_method='BEAUTY')
 bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.006);bpy.ops.object.mode_set(mode='OBJECT')
 image=bpy.data.images.new(obj.name+'_albedo',width=1024,height=1024,alpha=False)
 target=nodes.new('ShaderNodeTexImage');target.image=image;nodes.active=target
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=1
 scene.render.bake.use_pass_direct=False;scene.render.bake.use_pass_indirect=False;scene.render.bake.use_pass_color=True;scene.render.bake.margin=8
 bpy.ops.object.bake(type='DIFFUSE')
 image.filepath_raw=str(directory/(obj.name+'-albedo.png'));image.file_format='PNG';image.save();image.pack()
 nodes.clear();output=nodes.new('ShaderNodeOutputMaterial');shader=nodes.new('ShaderNodeBsdfPrincipled');shader.inputs['Roughness'].default_value=.82
 texture=nodes.new('ShaderNodeTexImage');texture.image=image;links.new(texture.outputs['Color'],shader.inputs['Base Color']);links.new(shader.outputs['BSDF'],output.inputs['Surface'])
 for name in [layer.name for layer in obj.data.uv_layers]:
  if name!='BakedUV': obj.data.uv_layers.remove(obj.data.uv_layers[name])
 obj.data.uv_layers.active=obj.data.uv_layers['BakedUV'];obj.data.uv_layers.active.active_render=True


def hinge_animation(identity,moving,root):
 pivot=(-.47,0,.02) if identity=='door' else (0,.34,.50)
 hinge=bpy.data.objects.new(identity+'_hinge',None);bpy.context.scene.collection.objects.link(hinge);hinge.location=pivot;hinge.parent=root
 bpy.context.view_layer.update()
 world=moving.matrix_world.copy();moving.parent=hinge;moving.matrix_world=world
 hinge.rotation_mode='XYZ';axis=2 if identity=='door' else 0;angle=-math.radians(96 if identity=='door' else 110)
 hinge.animation_data_create()
 for name,angles in [('open',(0,angle)),('close',(angle,0))]:
  action=bpy.data.actions.new(name);hinge.animation_data.action=action
  for frame,value in [(1,angles[0]),(31,angles[1])]:
   hinge.rotation_euler=(0,0,0);hinge.rotation_euler[axis]=value;hinge.keyframe_insert(data_path='rotation_euler',frame=frame)
  track=hinge.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,1,action);track.mute=True
  hinge.animation_data.action=None
 hinge.rotation_euler=(0,0,0)
 return hinge


def process(entry,args):
 identity=entry['id'];directory=OUT/identity;directory.mkdir(parents=True,exist_ok=True)
 inputs={part:digest(OUT/'parts'/part/'candidate.glb') for part in entry['parts']}
 if identity=='chest':inputs['frontTexture']=digest(OUT/'chest-front-atlas.png')
 inputs['finisher']=digest(Path(__file__));key=hashlib.sha256(json.dumps(inputs,sort_keys=True).encode()).hexdigest();record=directory/'asset.json'
 if record.exists() and not args.rebuild:
  old=json.loads(record.read_text())
  if old['inputHash']==key and old['sha256']==digest(directory/'model.glb'): print('REUSE '+identity,flush=True);return
  raise RuntimeError('Existing asset differs; use --rebuild for derived files: '+identity)
 print('FINISH '+identity,flush=True);started=time.monotonic()
 bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene;scene.unit_settings.system='METRIC';scene.render.fps=24
 bpy.context.preferences.filepaths.save_version=0
 parts={part:import_part(part) for part in entry['parts']}
 if identity=='door': subtract_box(parts['door-frame'],(1.04,2,2.24),(0,0,.92))
 if identity=='chest':
  level_chest_rim(parts['chest-base'])
  parts['chest-base'].data.update();bpy.context.view_layer.update()
  subtract_box(parts['chest-base'],(.84,.52,.65),(0,0,.405))
 if identity=='chest':chest_front_texture(parts['chest-base'])
 for obj in parts.values(): bake(obj,directory)
 root=bpy.data.objects.new(identity+'_asset',None);scene.collection.objects.link(root)
 for obj in parts.values(): obj.parent=root
 hinge=hinge_animation(identity,parts['door-leaf' if identity=='door' else 'chest-lid'],root) if entry['clips'] else None
 scene.frame_set(1);bpy.context.view_layer.update()
 bpy.ops.wm.save_as_mainfile(filepath=str(directory/'model.blend'))
 if hinge:
  for track in hinge.animation_data.nla_tracks: track.mute=False
 bpy.ops.object.select_all(action='DESELECT')
 for obj in list(parts.values())+[root]+([hinge] if hinge else []): obj.select_set(True)
 bpy.context.view_layer.objects.active=root
 bpy.ops.export_scene.gltf(filepath=str(directory/'model.glb'),export_format='GLB',use_selection=True,
                          export_animations=bool(hinge),export_animation_mode='NLA_TRACKS',export_skins=False,export_morph=False)
 if hinge:
  for track in hinge.animation_data.nla_tracks: track.mute=True
  hinge.animation_data.action=None;hinge.rotation_euler=(0,0,0)
 scene.frame_set(1);bpy.context.view_layer.update()
 vertices=np.concatenate([helper.points(obj) for obj in parts.values()]);bounds=np.array([vertices.min(axis=0),vertices.max(axis=0)])
 bpy.ops.object.camera_add();scene.camera=bpy.context.object
 scene.render.engine='CYCLES';scene.cycles.samples=12;scene.cycles.device='CPU'
 scene.render.resolution_x=768;scene.render.resolution_y=768;scene.render.resolution_percentage=100
 scene.world=bpy.data.worlds.new('Review world');scene.world.use_nodes=True
 scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.16,.19,.24,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.6
 height=float(bounds[1,2]-bounds[0,2]);center=Vector((0,0,height/2))
 for position,power in [((3,-4,6),450),((-3,-2,3),180),((1,3,5),250)]:
  bpy.ops.object.light_add(type='AREA',location=position);light=bpy.context.object;light.data.energy=power;light.data.size=4
  light.rotation_euler=(center-light.location).to_track_quat('-Z','Y').to_euler()
 for angle,label in [(0,'front'),(90,'side'),(180,'rear'),(30,'perspective')]: helper.render_view(scene,None,bounds,directory/(label+'.png'),angle)
 if hinge:
  hinge.animation_data.action=hinge.animation_data.nla_tracks['open'].strips[0].action;scene.frame_set(31);bpy.context.view_layer.update()
  opened=np.concatenate([helper.points(obj) for obj in parts.values()]);open_bounds=np.array([np.minimum(bounds[0],opened.min(axis=0)),np.maximum(bounds[1],opened.max(axis=0))])
  helper.render_view(scene,None,open_bounds,directory/'open.png',30)
 report={'format':'rougexr-hunyuan-prop-v1','id':identity,'inputHash':key,'inputs':inputs,'sha256':digest(directory/'model.glb'),
         'bytes':(directory/'model.glb').stat().st_size,'parts':entry['parts'],'clips':entry['clips'],'boundsMetresBlender':bounds.tolist(),
         'blenderVersion':bpy.app.version_string,'texture':'one 1024px baked atlas per generated component; approximate sides and rear',
         'animation':'authored rigid hinge motion' if hinge else 'static','seconds':round(time.monotonic()-started,2),'status':'review-draft',
         'clearance':'Boolean-cut unobstructed doorway' if identity=='door' else 'Boolean-cut empty chest interior' if identity=='chest' else None}
 record.write_text(json.dumps(report,indent=2)+'\n')
 license_source=ROOT.parent/'zxr/src/prototype/assets/TENCENT-HUNYUAN-3D-2.0-LICENSE.txt'
 (directory/license_source.name).write_bytes(license_source.read_bytes())
 (directory/'NOTICE.txt').write_text('Tencent Hunyuan 3D 2.0 is licensed under the Tencent Hunyuan 3D 2.0 Community License Agreement, Copyright © 2025 Tencent. All Rights Reserved. The trademark rights of “Tencent Hunyuan” are owned by Tencent or its affiliate.\nLocal generated review asset with rougeXR authored assembly and hinges. See accompanying license.\n')
 print('ASSET READY '+identity+' '+str(report['seconds'])+'s',flush=True)

def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('assets',nargs='*')
 parser.add_argument('--wait-for-meshes',action='store_true');parser.add_argument('--rebuild',action='store_true');args=parser.parse_args()
 for entry in CATALOG['assets']:
  if args.assets and entry['id'] not in args.assets: continue
  for part in entry['parts']:
   if not (OUT/'parts'/part/'candidate.json').exists() and args.wait_for_meshes: print('WAIT mesh '+part,flush=True)
   while not (OUT/'parts'/part/'candidate.json').exists() and args.wait_for_meshes: time.sleep(5)
  process(entry,args)
if __name__=='__main__': main()
