"""Serial local Hunyuan image-to-mesh generation for the eight prop components."""
from pathlib import Path
import argparse, hashlib, importlib.util, json, os, time
ROOT=Path(__file__).resolve().parents[2]
REF=ROOT/'art/prop-references/hunyuan-v1'
OUT=ROOT/'out/props-v1'
def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def main():
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('parts',nargs='*'); parser.add_argument('--wait-for-references',action='store_true')
 parser.add_argument('--zxr-root',type=Path,default=ROOT.parent/'zxr'); args=parser.parse_args()
 os.environ['HF_HUB_OFFLINE']='1'; os.environ['TOKENIZERS_PARALLELISM']='false'
 spec=importlib.util.spec_from_file_location('zxr_generate',args.zxr_root/'tools/assets/generate.py')
 helper=importlib.util.module_from_spec(spec); spec.loader.exec_module(helper)
 from PIL import Image,ImageFilter
 import numpy as np
 import trimesh
 from scipy.ndimage import distance_transform_edt
 entries=json.loads((REF/'prompts.json').read_text())['parts']; pipe=None
 for entry in entries:
  identity=entry['id']
  if args.parts and identity not in args.parts: continue
  reference=REF/entry['reference']
  if not reference.exists() and args.wait_for_references: print('WAIT reference '+identity,flush=True)
  while not reference.exists() and args.wait_for_references: time.sleep(5)
  directory=OUT/'parts'/identity; directory.mkdir(parents=True,exist_ok=True)
  options={'referenceSha256':digest(reference),'pipeline':helper.PIPELINE,'heightMetres':entry['heightMetres'],
           'triangles':entry['triangles'],'projectionHelperSha256':digest(args.zxr_root/'tools/assets/generate.py'),
           'textureMethod':'front projection with spatially blurred rear approximation'}
  key=hashlib.sha256(json.dumps(options,sort_keys=True).encode()).hexdigest(); record=directory/'candidate.json'
  if record.exists():
   old=json.loads(record.read_text())
   if old['inputHash']==key and old['sha256']==digest(directory/'candidate.glb'):
    print('REUSE '+identity,flush=True); continue
   raise RuntimeError('Preserve this version; existing candidate inputs differ: '+identity)
  started=time.monotonic(); raw_path=directory/'raw.glb'; raw_record=directory/'raw.json'
  if raw_path.exists():
   meta=json.loads(raw_record.read_text())
   if meta['inputHash']!=key or meta['sha256']!=digest(raw_path): raise RuntimeError('Raw mesh input mismatch')
   raw=trimesh.load(raw_path,force='mesh')
  else:
   import mlx.core as mx
   from hy3dmlx.pipeline import Hunyuan3DShapePipeline
   if pipe is None:
    print('LOAD local Hunyuan3D Turbo / MLX',flush=True)
    pipe=Hunyuan3DShapePipeline.from_pretrained(str(args.zxr_root/'out/asset-tools/weights/hunyuan2-turbo/hunyuan3d-dit-v2-0-turbo'),dtype=mx.float16,quantize=8)
   print('GENERATE '+identity,flush=True)
   raw=pipe.generate(str(reference),num_inference_steps=8,guidance_scale=5,octree_resolution=256,seed=42,octree_decode=True)
   raw.export(raw_path); raw_record.write_text(json.dumps({'inputHash':key,'sha256':digest(raw_path)},indent=2)+'\n')
  mesh,components=helper.prepare(raw,reference,entry['triangles'],[1,entry['heightMetres'],1])
  pixels=np.array(Image.open(reference).convert('RGBA')); mask=pixels[:,:,3]>127
  nearest=distance_transform_edt(~mask,return_distances=False,return_indices=True)
  extended=Image.fromarray(pixels[:,:,:3][tuple(nearest)])
  atlas=Image.new('RGB',(1024,1024)); atlas.paste(extended.resize((768,1024),Image.Resampling.LANCZOS),(0,0))
  atlas.paste(extended.filter(ImageFilter.GaussianBlur(18)).resize((256,1024),Image.Resampling.LANCZOS),(768,0))
  yy,xx=np.where(mask); lo,hi=mesh.bounds; rear=mesh.visual.uv[:,0]>.75
  u=(xx.min()+(mesh.vertices[:,0]-lo[0])/(hi[0]-lo[0])*(xx.max()-xx.min()))/mask.shape[1]
  mesh.visual.uv[rear,0]=.75+u[rear]*.25; mesh.visual.material.baseColorTexture=atlas
  mesh.export(directory/'candidate.glb')
  report={'format':'rougexr-hunyuan-prop-part-v1','id':identity,'inputHash':key,**options,
          'sha256':digest(directory/'candidate.glb'),'rawTriangles':len(raw.faces),'triangles':len(mesh.faces),
          'boundsMetres':mesh.bounds.tolist(),'componentsBeforeCleanup':components,'seconds':round(time.monotonic()-started,2)}
  record.write_text(json.dumps(report,indent=2)+'\n')
  print('MESH READY '+identity+' '+str(report['seconds'])+'s',flush=True)
  del raw,mesh
  if pipe is not None: mx.clear_cache()
if __name__=='__main__': main()
