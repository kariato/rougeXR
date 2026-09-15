"""Original procedural room and pickup props. Blender 4.5 LTS; no external assets.

Run: blender --background --python tools/blender/create_room_prop.py -- --asset rubble
"""
import bpy,sys,math
from pathlib import Path
from mathutils import Vector
names=('rubble','pillar','urn','crate','torch','mushroom','bones','coinScatter','scroll','food','weapon','armor','amulet','ring','stick')
arg=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
if len(arg)!=2 or arg[0]!='--asset' or arg[1] not in names:raise SystemExit('Use -- --asset <'+','.join(names)+'>')
N=arg[1];R=Path(__file__).resolve().parents[2];S=R/f'art/blender/props/{N}.blend';E=R/f'public/assets/props/{N}.glb';P=R/f'art/previews/{N}.png'
for p in(S,E,P):p.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False);bpy.context.preferences.filepaths.save_version=0;sc=bpy.context.scene;sc.unit_settings.system='METRIC'
def mat(n,c,metal=0):
 m=bpy.data.materials.new(n);m.diffuse_color=(*c,1);m.use_nodes=True;b=m.node_tree.nodes['Principled BSDF'];b.inputs['Base Color'].default_value=(*c,1);b.inputs['Metallic'].default_value=metal;b.inputs['Roughness'].default_value=.4 if metal else .85;return m
stone=mat('aged_stone',(.39,.38,.34));light=mat('worn_edge',(.58,.53,.43));dark=mat('deep_crevice',(.13,.12,.11));wood=mat('old_wood',(.37,.18,.07));iron=mat('forged_iron',(.19,.21,.23),.65);gold=mat('decorative_gold',(.79,.49,.08),.78);bone=mat('dry_bone',(.72,.67,.52));green=mat('forest_green',(.16,.42,.25));red=mat('mushroom_red',(.67,.12,.10));cloth=mat('linen',(.63,.50,.32));blue=mat('gem_blue',(.11,.46,.69));purple=mat('gem_violet',(.45,.12,.56))
flame=mat('glowing_flame',(1.0,.36,.04));flame.node_tree.nodes['Principled BSDF'].inputs['Emission Color'].default_value=(1.0,.22,.015,1);flame.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value=2.5
apple=mat('apple_skin',(.82,.08,.055));banana_yellow=mat('banana_peel',(.92,.70,.13));fruit_stem=mat('fruit_stem',(.28,.16,.06))
def cube(n,c,s,m):
 bpy.ops.mesh.primitive_cube_add(size=1,location=c);o=bpy.context.object;o.name=n;o.dimensions=s;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m);return o
def ico(n,c,s,m):
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=c);o=bpy.context.object;o.name=n;o.scale=s;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m);return o
def cyl(n,c,r,h,m,vertices=12):
 bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=h,location=c);o=bpy.context.object;o.name=n;o.data.materials.append(m);return o
def cone(n,a,z,r,m):
 d=Vector(z)-Vector(a);bpy.ops.mesh.primitive_cone_add(vertices=10,radius1=r,radius2=0,depth=d.length,location=(Vector(a)+Vector(z))/2);o=bpy.context.object;o.name=n;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();bpy.ops.object.transform_apply(location=False,rotation=True,scale=True);o.data.materials.append(m);return o
def tor(n,c,r,t,m):
 bpy.ops.mesh.primitive_torus_add(major_segments=16,minor_segments=6,location=c,major_radius=r,minor_radius=t);o=bpy.context.object;o.name=n;o.data.materials.append(m);return o
if N=='rubble':
 for i,(x,y,r) in enumerate([(-.22,-.12,.14),(-.02,.05,.19),(.19,-.10,.12),(.18,.16,.08),(-.20,.16,.07)]):ico(f'fallen_rock_{i}',(x,y,r*.55),(r,r*.8,r*.55),light if i%3==0 else stone)
elif N=='pillar':
 cyl('plinth',(0,0,.08),.25,.16,stone);cyl('fluted_shaft',(0,0,.55),.16,.83,light);cyl('capital',(0,0,1.01),.24,.11,stone)
 for i in range(8):a=i*math.tau/8;cyl(f'flute_{i}',(.145*math.sin(a),.145*math.cos(a),.55),.024,.74,stone,6)
elif N=='urn':
 ico('amphora_body',(0,0,.30),(.19,.17,.29),stone);cyl('neck',(0,0,.60),.10,.12,light);tor('lip',(0,0,.66),.11,.019,light);cyl('foot',(0,0,.045),.12,.09,stone)
 for s in (-1,1):o=tor(f'handle_{s}',(s*.18,0,.48),.105,.023,light);o.rotation_euler.y=math.pi/2
elif N=='crate':
 # Keep the historical 'crate' asset ID while giving it a clear treasure-chest silhouette.
 cube('chest_coffer',(0,0,.22),(.54,.39,.37),wood)
 cube('dark_lid_seam',(0,-.208,.405),(.55,.015,.028),dark)
 cube('front_brass_rim',(0,-.211,.39),(.56,.027,.035),gold)
 cube('front_base_rim',(0,-.211,.045),(.56,.027,.033),iron)
 for x in (-.245,.245):cube(f'corner_guard_{x}',(x,-.218,.22),(.036,.029,.34),iron)
 # A five-facet barrel lid, highest at the crown, is readable even at gameplay scale.
 for i in range(5):
  y=-.172+i*.086;z=.453+.10*math.sin((i+1)*math.pi/6)
  cube(f'arched_lid_panel_{i}',(0,y,z),(.56,.10,.085),wood)
  for x in (-.19,.19):cube(f'curved_iron_band_{x}_{i}',(x,y,z+.046),(.034,.097,.016),iron)
 cube('front_hasplock',(0,-.234,.325),(.115,.029,.165),gold)
 cube('keyhole',(0,-.253,.326),(.025,.009,.062),dark)
 ico('lock_rivet',(0,-.258,.392),(.018,.009,.018),iron)
 for x in (-.205,.205):
  ico(f'front_rivet_{x}',(x,-.238,.393),(.017,.009,.017),gold)
 cube('rear_brass_rim',(0,.211,.39),(.56,.027,.035),gold)
 for x in (-.245,.245):cube(f'rear_corner_guard_{x}',(x,.218,.22),(.036,.029,.34),iron)
 for side in (-1,1):cube(f'side_brass_lockplate_{side}',(side*.278,0,.30),(.015,.14,.12),gold)
elif N=='torch':
 cube('wall_backplate',(0,0,0),(.23,.035,.29),iron)
 for z in (-.105,.105):ico(f'plate_rivet_{z}',(0,-.024,z),(.018,.008,.018),gold)
 arm=cyl('forged_wall_arm',(0,-.125,-.065),.026,.22,iron,8);arm.rotation_euler.x=math.pi/2
 cyl('torch_cup',(0,-.245,.005),.11,.13,iron,10)
 tor('cup_rim',(0,-.245,.078),.11,.018,gold)
 ico('flame_core',(0,-.245,.235),(.072,.070,.16),flame)
 ico('flame_tip',(0,-.245,.357),(.038,.040,.075),flame)
 ico('ember_base',(0,-.245,.125),(.065,.065,.04),red)
elif N=='mushroom':
 for i,(x,y,h) in enumerate([(-.18,-.08,.29),(.11,.06,.39),(.21,-.12,.19)]):
  cyl(f'stalk_{i}',(x,y,h*.45),.045,h*.9,cloth);ico(f'cap_{i}',(x,y,h),(.15 if i==1 else .10,.13 if i==1 else .09,.075),red)
  for j in range(3):ico(f'spot_{i}_{j}',(x+(j-1)*.04,y-.04,h+.048),(.012,.012,.007),cloth)
elif N=='bones':
 def skeletal_bone(n,a,b,r=.014):
  direction=Vector(b)-Vector(a);o=cyl(n,(Vector(a)+Vector(b))/2,r,direction.length,bone,8);o.rotation_euler=direction.to_track_quat('Z','Y').to_euler();return o
 # A fallen body lies flat across the cell, with the skull facing the player.
 ico('cranium',(0,-.36,.12),(.11,.095,.095),bone)
 ico('left_eye',(-.043,-.439,.13),(.025,.012,.025),dark);ico('right_eye',(.043,-.439,.13),(.025,.012,.025),dark)
 ico('nose_cavity',(0,-.451,.095),(.013,.009,.016),dark)
 ico('jaw',(0,-.408,.045),(.078,.035,.025),bone)
 for i in range(5):cube(f'tooth_{i}',((i-2)*.025,-.442,.042),(.014,.009,.017),light)
 skeletal_bone('neck',(0,-.27,.078),(0,-.21,.076),.018)
 for i in range(7):ico(f'vertebra_{i}',(0,-.18+i*.053,.065),(.024,.024,.026),bone)
 skeletal_bone('sternum',(0,-.17,.075),(0,.05,.075),.018)
 for i in range(4):
  y=-.145+i*.058
  for side in (-1,1):
   skeletal_bone(f'rib_{i}_{side}_inner',(0,y,.075),(side*(.07+i*.007),y+.018,.065),.011)
   skeletal_bone(f'rib_{i}_{side}_outer',(side*(.07+i*.007),y+.018,.065),(side*(.13-i*.006),y+.05,.056),.011)
 for side in (-1,1):
  skeletal_bone(f'collar_{side}',(0,-.22,.076),(side*.16,-.19,.063),.016)
  ico(f'shoulder_{side}',(side*.17,-.18,.066),(.028,.027,.025),bone)
  skeletal_bone(f'upper_arm_{side}',(side*.17,-.18,.066),(side*.33,-.025,.049),.017)
  ico(f'elbow_{side}',(side*.33,-.025,.049),(.023,.023,.019),bone)
  skeletal_bone(f'forearm_{side}',(side*.33,-.025,.049),(side*.39,.13,.036),.013)
  ico(f'hand_{side}',(side*.40,.145,.035),(.035,.026,.014),bone)
  skeletal_bone(f'hip_{side}',(0,.155,.060),(side*.095,.22,.052),.022)
  ico(f'hip_joint_{side}',(side*.095,.22,.052),(.032,.028,.024),bone)
  skeletal_bone(f'femur_{side}',(side*.095,.22,.052),(side*.16,.37,.042),.020)
  ico(f'kneecap_{side}',(side*.16,.37,.042),(.025,.024,.019),bone)
  skeletal_bone(f'shin_{side}',(side*.16,.37,.042),(side*.20,.49,.034),.014)
  ico(f'foot_{side}',(side*.21,.50,.030),(.047,.029,.014),bone)
 skeletal_bone('pelvis_bridge',(-.095,.22,.052),(.095,.22,.052),.018)
elif N=='coinScatter':
 for i,(x,y,z) in enumerate([(-.22,-.09,.018),(-.12,.12,.018),(.02,-.14,.018),(.16,.04,.018),(.24,-.14,.018),(0,.08,.049),(.04,.12,.080)]):cyl(f'decorative_coin_{i}',(x,y,z),.07,.015,gold,14);tor(f'coin_rim_{i}',(x,y,z+.009),.061,.003,wood)
elif N=='scroll':
 o=cyl('rolled_parchment',(0,0,.11),.085,.42,cloth);o.rotation_euler.y=math.pi/2
 for x in (-.20,.20):o=cyl(f'wood_end_{x}',(x,0,.11),.09,.018,wood);o.rotation_euler.y=math.pi/2
 for x in (-.07,.07):tor(f'seal_band_{x}',(x,0,.11),.085,.012,gold)
elif N=='food':
 for i,(x,y) in enumerate([(-.16,.08),(.08,.15)]):
  ico(f'apple_{i}',(x,y,.115),(.105,.10,.105),apple)
  cyl(f'apple_stem_{i}',(x,y,.226),.009,.055,fruit_stem,7)
  leaf=ico(f'apple_leaf_{i}',(x+.035,y-.01,.244),(.04,.018,.009),green);leaf.rotation_euler.z=-.3
 def make_banana(i,x,y,angle):
  vertices=[];faces=[];rings=9;segments=8
  for j in range(rings):
   t=j/(rings-1);cx=(t-.5)*.37;cy=.095*math.sin(math.pi*t);cz=.075+.035*math.sin(math.pi*t)
   radius=.012+.031*math.sin(math.pi*t)
   for k in range(segments):
    a=math.tau*k/segments;vertices.append((cx,cy+radius*math.cos(a),cz+radius*math.sin(a)))
  faces.append(tuple(reversed(range(segments))))
  for j in range(rings-1):
   for k in range(segments):faces.append((j*segments+k,j*segments+(k+1)%segments,(j+1)*segments+(k+1)%segments,(j+1)*segments+k))
  faces.append(tuple((rings-1)*segments+k for k in range(segments)))
  mesh=bpy.data.meshes.new(f'banana_{i}_mesh');mesh.from_pydata(vertices,[],faces);mesh.update()
  fruit=bpy.data.objects.new(f'banana_{i}',mesh);bpy.context.collection.objects.link(fruit);fruit.location=(x,y,0);fruit.rotation_euler.z=angle;mesh.materials.append(banana_yellow)
  for side in (-1,1):
   tip=ico(f'banana_{i}_tip_{side}',(x+side*.19*math.cos(angle),y+side*.19*math.sin(angle),.075),(.017,.016,.017),fruit_stem);tip.rotation_euler.z=angle
 make_banana(0,-.015,-.15,-.12);make_banana(1,.035,-.075,.22)
elif N=='weapon':
 cyl('mace_handle',(0,0,.35),.034,.61,wood);ico('mace_head',(0,0,.69),(.12,.12,.12),iron)
 for i in range(6):a=i*math.tau/6;cone(f'spike_{i}',(.08*math.sin(a),.08*math.cos(a),.69),(.19*math.sin(a),.19*math.cos(a),.69),.033,iron)
 tor('grip_band',(0,0,.17),.04,.01,gold)
elif N=='armor':
 ico('mail_torso',(0,0,.40),(.23,.15,.36),iron);ico('collar',(0,-.015,.75),(.17,.13,.07),light)
 for s in (-1,1):ico(f'shoulder_{s}',(s*.24,0,.62),(.14,.13,.12),iron);cube(f'belt_{s}',(s*.15,-.14,.23),(.23,.035,.055),wood)
 for row in range(4):
  for col in range(5):ico(f'mail_ring_{row}_{col}',((col-2)*.075,-.154,.32+row*.09),(.018,.007,.018),light)
elif N=='amulet':
 o=tor('chain',(0,0,.52),.25,.012,gold);o.rotation_euler.x=math.pi/2
 ico('central_gem',(0,-.02,.28),(.10,.04,.13),blue);tor('gem_setting',(0,-.015,.28),.10,.016,gold)
elif N=='ring':
 o=tor('ring_band',(0,0,.12),.115,.027,gold);o.rotation_euler.x=math.pi/2
 ico('ring_gem',(0,-.06,.23),(.055,.045,.06),purple);cube('gem_prongs',(0,-.065,.19),(.10,.03,.035),gold)
elif N=='stick':
 o=cyl('carved_wand',(0,0,.10),.028,.60,wood);o.rotation_euler.y=math.pi/2
 ico('crystal_tip',(.31,0,.10),(.07,.055,.07),blue)
 for x in (-.15,.08):o=tor(f'metal_band_{x}',(x,0,.10),.028,.009,gold);o.rotation_euler.y=math.pi/2
bpy.ops.wm.save_as_mainfile(filepath=str(S));bpy.ops.object.select_all(action='DESELECT')
for o in sc.objects:
 if o.type=='MESH':o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(E),export_format='GLB',use_selection=True,export_animations=False)
target_height=.10 if N in ('rubble','bones','coinScatter','scroll','food','ring','stick') else .52 if N=='pillar' else .42 if N in ('weapon','armor','amulet') else .08 if N=='torch' else .30
preview_scale=1.65 if N=='pillar' else 1.35 if N=='bones' else 1.20 if N in ('weapon','armor','amulet','crate') else 1.05 if N=='urn' else .8
bpy.ops.object.camera_add(location=(1.0,-1.8,1.35));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,target_height))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=preview_scale;sc.camera=cam
sc.render.engine='BLENDER_WORKBENCH';sc.display.shading.light='STUDIO';sc.display.shading.color_type='MATERIAL';sc.display.shading.show_shadows=True;sc.display.shading.show_cavity=True;sc.display.shading.background_type='WORLD';sc.world.color=(.035,.045,.065);sc.render.resolution_x=900;sc.render.resolution_y=700;sc.render.resolution_percentage=100;sc.render.image_settings.file_format='PNG';sc.render.filepath=str(P);bpy.ops.render.render(write_still=True);print('CREATED',S,E,P)
