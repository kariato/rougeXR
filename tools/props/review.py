"""Create the local generated-prop gallery, manifests, and inspection sheets."""
from pathlib import Path
import hashlib,html,json
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'out/props-v1';REF=ROOT/'art/prop-references/hunyuan-v1'
catalog=json.loads((REF/'prompts.json').read_text());summary=[];cards=[]
validation={r['id']:r for r in json.loads((OUT/'validation.json').read_text())} if (OUT/'validation.json').exists() else {}
for part in catalog['parts']+catalog.get('supportingTextures',[]):
 p=REF/part['reference']
 if not p.exists():continue
 with Image.open(p) as image:
  if image.mode!='RGBA' or image.getchannel('A').getextrema()[0]!=0:raise ValueError('Expected transparent reference: '+part['reference'])
for asset in catalog['assets']:
 id=asset['id'];directory=OUT/id
 if not (directory/'asset.json').exists():continue
 report=json.loads((directory/'asset.json').read_text());check=validation.get(id)
 if hashlib.sha256((directory/'model.glb').read_bytes()).hexdigest()!=report['sha256']:raise ValueError('Asset hash mismatch: '+id)
 item={'id':id,'referenceImages':['art/prop-references/hunyuan-v1/'+part+'.png' for part in asset['parts']],
       'glb':'out/props-v1/'+id+'/model.glb','blender':'out/props-v1/'+id+'/model.blend','sha256':report['sha256'],
       'clips':asset['clips'],'validation':check};
 if id=='chest':item['referenceImages'].append('art/prop-references/hunyuan-v1/chest-base-front.png')
 summary.append(item)
 refs=''.join(f'<figure><img loading="lazy" src="../../art/prop-references/hunyuan-v1/{part}.png"><figcaption>{html.escape(part)}</figcaption></figure>' for part in asset['parts'])
 if id=='chest':refs+='<figure><img loading="lazy" src="../../art/prop-references/hunyuan-v1/chest-base-front.png"><figcaption>Front panel texture reference</figcaption></figure>'
 views=['perspective','front','side','rear']+(['open'] if asset['clips'] else [])
 pictures=''.join(f'<figure><img loading="lazy" src="{id}/{view}.png"><figcaption>{view.title()}</figcaption></figure>' for view in views)
 counts=f'{check["vertices"]:,} vertices · {check["triangles"]:,} triangles · ' if check else ''
 cards.append(f'<article><h2>{id.title()}</h2><p>{counts}{"Open / close clips" if asset["clips"] else "Static prop"}</p><div class="views">{pictures}</div><p><a href="/model-preview.html?model={id}&set=hunyuan-props-v1">Inspect 3D {"and play animations" if asset["clips"] else ""}</a> · <a href="{id}/model.glb">GLB</a> · <a href="{id}/model.blend">Blender source</a></p><details><summary>Source component images</summary><div class="views">{refs}</div></details></article>')
style='body{font:16px system-ui;margin:32px;background:#111820;color:#e6edf3}a{color:#8ddbd0}article{padding:20px 0;border-top:1px solid #46505a}.views{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}figure{margin:0}img{width:100%;aspect-ratio:1;object-fit:contain;background:#29343d}figcaption{padding:8px}p{max-width:900px;line-height:1.5}details .views{grid-template-columns:repeat(2,minmax(0,320px))}'
(OUT/'index.html').write_text(f'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>rougeXR · generated prop review</title><style>{style}</style><h1>rougeXR · generated props v1</h1><p>{len(summary)} assembled assets from eight individual shape references, one supporting front texture, and local Hunyuan meshes. The door and chest use separate moving components with authored hinges. Rear textures are approximations; this is a local art-review collection.</p><p><a href="/out/monsters-v1/index.html">Monster collection</a></p>'+''.join(cards))
manifest={'format':'rougexr-prop-collection-v1','status':'review-draft','referenceGenerator':'built-in ImageGen','meshGenerator':'Tencent Hunyuan3D 2.0 Turbo via local MLX','animationSource':'authored rigid hinges','assets':summary}
(OUT/'collection.json').write_text(json.dumps(manifest,indent=2)+'\n')
if len(summary)==6 and len(validation)==6:(REF/'asset-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
for name,entries,source in [('references',catalog['parts'],lambda id:REF/(id+'.png')),('meshes',catalog['assets'],lambda id:OUT/id/'perspective.png')]:
 cols=3;w=300;h=330;sheet=Image.new('RGB',(cols*w,((len(entries)+cols-1)//cols)*h),'#26313a');draw=ImageDraw.Draw(sheet)
 for i,entry in enumerate(entries):
  p=source(entry['id'])
  if not p.exists():continue
  with Image.open(p) as image:
   thumb=image.convert('RGBA');thumb.thumbnail((w-20,h-40));x=i%cols*w+(w-thumb.width)//2;y=i//cols*h+6;sheet.paste(thumb,(x,y),thumb)
  draw.text((i%cols*w+12,i//cols*h+h-24),entry['id'].replace('-',' ').title(),fill='white')
 sheet.save(OUT/(name+'-overview.jpg'),quality=92)
print(str(len(summary))+' assets; '+str(len(validation))+' verified; gallery: '+str(OUT/'index.html'))
