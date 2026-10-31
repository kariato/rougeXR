"""Build a local review gallery and contact sheets; original images stay intact."""
from pathlib import Path
import html
import json
from PIL import Image, ImageDraw
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'out/monsters-v1'
REF = ROOT / 'art/monster-references/hunyuan-v1'
entries = json.loads((REF / 'prompts.json').read_text())['monsters']
OUT.mkdir(parents=True, exist_ok=True)
summary = []
cards = []
for entry in entries:
    identity = entry['id']
    directory = OUT / identity
    reference = REF / entry['reference']
    animation = json.loads((directory / 'animation.json').read_text()) if (directory / 'animation.json').exists() else None
    if not reference.exists(): continue
    with Image.open(reference) as image:
        if image.mode != 'RGBA' or image.getchannel('A').getextrema()[0] != 0:
            raise ValueError('Reference does not have genuine transparent background: ' + identity)
    summary.append({'id': identity, 'reference': str(reference.relative_to(ROOT)),
                    'animated': animation is not None, 'animation': animation})
    name = html.escape(identity.replace('-', ' ').title())
    pictures = [f'<figure><img loading="lazy" src="../../art/monster-references/hunyuan-v1/{identity}.png"><figcaption>Reference</figcaption></figure>']
    if animation:
        pictures += [f'<figure><img loading="lazy" src="{identity}/{view}.png"><figcaption>{view.title()}</figcaption></figure>' for view in ['front', 'side', 'rear']]
    link = f'/model-preview.html?model={identity}&set=hunyuan-v1'
    cards.append(f'<article><h2>{name}</h2><div class="views">{"".join(pictures)}</div><p><a href="{link}">Play animations</a> · <a href="{identity}/animated.glb">GLB</a> · <a href="{identity}/animated.blend">Blender source</a></p></article>')
style = 'body{font:16px system-ui;margin:32px;background:#111820;color:#e6edf3}h1{margin-bottom:8px}a{color:#8ddbd0}article{border-top:1px solid #46505a;padding:20px 0}.views{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}figure{margin:0}img{width:100%;aspect-ratio:1;object-fit:contain;background:#29343d}figcaption{padding:8px}p{max-width:850px;line-height:1.5}@media(max-width:700px){.views{grid-template-columns:repeat(2,1fr)}}'
(OUT / 'index.html').write_text(f'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>rougeXR · Hunyuan monster review</title><style>{style}</style><h1>rougeXR · monster collection v1</h1><p>{len(summary)} references · {sum(s["animated"] for s in summary)} animated meshes. Clips: idle, move, attack, hurt, death. Drag in the animation viewer to inspect all sides. Single-view textures and transferred skin weights are drafts for review.</p>'+''.join(cards))
(OUT / 'collection.json').write_text(json.dumps(summary, indent=2)+'\n')
# Inspection sheets compose thumbnails only; they never replace reference assets.
for label, source in [('references', lambda i: REF / (i+'.png')), ('meshes', lambda i: OUT / i / 'front.png')]:
    width, height = 250, 285
    sheet = Image.new('RGB', (width*6, height*5), '#26313a')
    draw = ImageDraw.Draw(sheet)
    for index, entry in enumerate(entries):
        image_path = source(entry['id'])
        if not image_path.exists(): continue
        with Image.open(image_path) as image:
            thumb = image.convert('RGBA'); thumb.thumbnail((width-16,height-38))
            x=(index%6)*width+(width-thumb.width)//2; y=(index//6)*height+8
            sheet.paste(thumb,(x,y),thumb)
        draw.text(((index%6)*width+10,(index//6)*height+height-22),entry['id'].replace('-',' ').title(),fill='white')
    sheet.save(OUT / (label+'-overview.jpg'),quality=92)
print(f'{len(summary)} references; {sum(s["animated"] for s in summary)} animated meshes; gallery: {OUT / "index.html"}')
