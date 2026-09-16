"""Fast structural validation for self-contained static room-prop GLBs."""
import json,struct,sys
from pathlib import Path
p=Path(sys.argv[1]);d=p.read_bytes()
magic,version,total=struct.unpack_from('<4sII',d)
assert magic==b'glTF' and version==2 and total==len(d),f'{p}: invalid GLB header'
length,kind=struct.unpack_from('<I4s',d,12)
assert kind==b'JSON' and length>0,f'{p}: missing JSON chunk'
doc=json.loads(d[20:20+length]);assert doc.get('meshes') and doc.get('nodes') and doc.get('materials'),f'{p}: missing renderable content'
if p.stem=='crate':
 assert any(a.get('name')=='open' for a in doc.get('animations',[])),f'{p}: missing open animation'
else:assert not doc.get('animations') and not doc.get('skins'),f'{p}: room prop must be static'
assert all('uri' not in b for b in doc.get('buffers',[])),f'{p}: external buffer'
assert all('uri' not in image for image in doc.get('images',[])),f'{p}: external image'
print(f'VALID {p.name}: {len(doc["meshes"])} mesh(es), {len(doc["materials"])} material(s), {len(d)} bytes')
