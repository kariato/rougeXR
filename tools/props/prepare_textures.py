"""Prepare the separately generated front-panel texture used by the chest."""
from pathlib import Path
import json
import numpy as np
from PIL import Image,ImageFilter
from scipy.ndimage import distance_transform_edt
ROOT=Path(__file__).resolve().parents[2];REF=ROOT/'art/prop-references/hunyuan-v1';OUT=ROOT/'out/props-v1'
OUT.mkdir(parents=True,exist_ok=True)
pixels=np.array(Image.open(REF/'chest-base-front.png').convert('RGBA'));mask=pixels[:,:,3]>127
nearest=distance_transform_edt(~mask,return_distances=False,return_indices=True)
extended=Image.fromarray(pixels[:,:,:3][tuple(nearest)])
atlas=Image.new('RGB',(1024,1024));atlas.paste(extended.resize((768,1024),Image.Resampling.LANCZOS),(0,0))
atlas.paste(extended.filter(ImageFilter.GaussianBlur(18)).resize((256,1024),Image.Resampling.LANCZOS),(768,0))
atlas.save(OUT/'chest-front-atlas.png');yy,xx=np.where(mask)
(OUT/'chest-front-atlas.json').write_text(json.dumps({'width':pixels.shape[1],'height':pixels.shape[0],'bounds':[int(xx.min()),int(yy.min()),int(xx.max()),int(yy.max())]})+'\n')
print('Prepared chest front texture atlas')
