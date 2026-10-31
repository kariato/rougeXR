from pathlib import Path
import importlib.util
import bpy,bmesh
import numpy as np
spec=importlib.util.spec_from_file_location('props',Path(__file__).with_name('finish_assets.py'))
f=importlib.util.module_from_spec(spec);spec.loader.exec_module(f)
bpy.ops.wm.read_factory_settings(use_empty=True)
for identity in ['chest-base','door-frame']:
 obj=f.import_part(identity)
 def stats(label):
  bm=bmesh.new();bm.from_mesh(obj.data)
  v=np.array([tuple(x.co) for x in obj.data.vertices]);front=v[v[:,1]<-.25]
  print(label,'volume',bm.calc_volume(signed=True),'boundary',sum(not e.is_manifold for e in bm.edges),'bounds',v.min(0),v.max(0),'frontTop',front[:,2].max() if len(front) else None,flush=True);bm.free()
 stats(identity)
 if identity=='chest-base':f.level_chest_rim(obj);obj.data.update();bpy.context.view_layer.update();stats('leveled')
 bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
 if bm.calc_volume(signed=True)<0:bmesh.ops.reverse_faces(bm,faces=list(bm.faces))
 bm.to_mesh(obj.data);bm.free();obj.data.update();bpy.context.view_layer.update();stats('normals repaired')
 if identity=='chest-base':f.subtract_box(obj,(.84,.52,.65),(0,0,.405))
 else:f.subtract_box(obj,(1.04,2,2.24),(0,0,.92))
 stats('cut')
