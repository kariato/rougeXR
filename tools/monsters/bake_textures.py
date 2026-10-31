"""Bake a smooth front/rear projection blend into a regular GLB PBR atlas."""
from pathlib import Path
import importlib.util
import json
import math
import hashlib
import sys
import bpy
import numpy as np
from mathutils import Vector
ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('animation_helpers', Path(__file__).with_name('animate_meshes.py'))
helper = importlib.util.module_from_spec(spec); spec.loader.exec_module(helper)
entries = {e['id']: e for e in json.loads((ROOT/'art/monster-references/hunyuan-v1/prompts.json').read_text())['monsters']}
for identity in (sys.argv[1:] or entries):
    directory = ROOT/'out/monsters-v1'/identity
    record = directory/'animation.json'
    report = json.loads(record.read_text())
    script_hash = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    if report.get('textureFinisherSha256') == script_hash:
        print('REUSE TEXTURE '+identity, flush=True); continue
    bpy.ops.wm.open_mainfile(filepath=str(directory/'animated.blend'))
    scene = bpy.context.scene
    mesh = next(o for o in scene.objects if o.type == 'MESH')
    rig = next(o for o in scene.objects if o.type == 'ARMATURE')
    old_uv = [tuple(uv.uv) for uv in mesh.data.uv_layers.active.data]
    front_uv = mesh.data.uv_layers.new(name='ReferenceFront')
    back_uv = mesh.data.uv_layers.new(name='ReferenceBack')
    for index, uv in enumerate(old_uv):
        u, v = uv
        source_u = (u-.75)/.25 if u > .75 else u/.75
        mesh.data.uv_layers['ReferenceFront'].data[index].uv = (source_u*.75, v)
        mesh.data.uv_layers['ReferenceBack'].data[index].uv = (.75+source_u*.25, v)
    material = mesh.data.materials[0]
    nodes = material.node_tree.nodes; links = material.node_tree.links
    source_image = next(n.image for n in nodes if n.type == 'TEX_IMAGE')
    nodes.clear()
    output = nodes.new('ShaderNodeOutputMaterial')
    shader = nodes.new('ShaderNodeBsdfPrincipled'); shader.inputs['Roughness'].default_value = .85
    links.new(shader.outputs['BSDF'], output.inputs['Surface'])
    textures = []
    for name in ['ReferenceBack', 'ReferenceFront']:
        uv = nodes.new('ShaderNodeUVMap'); uv.uv_map = name
        texture = nodes.new('ShaderNodeTexImage'); texture.image = source_image
        links.new(uv.outputs['UV'], texture.inputs['Vector']); textures.append(texture)
    geometry = nodes.new('ShaderNodeNewGeometry')
    dot = nodes.new('ShaderNodeVectorMath'); dot.operation='DOT_PRODUCT'; dot.inputs[1].default_value=(0,-1,0)
    links.new(geometry.outputs['Normal'], dot.inputs[0])
    factor = nodes.new('ShaderNodeMapRange'); factor.clamp=True
    factor.inputs['From Min'].default_value=-.25; factor.inputs['From Max'].default_value=.5
    links.new(dot.outputs['Value'], factor.inputs['Value'])
    mix=nodes.new('ShaderNodeMixRGB'); mix.blend_type='MIX'
    links.new(factor.outputs['Result'],mix.inputs[0])
    links.new(textures[0].outputs['Color'],mix.inputs[1]); links.new(textures[1].outputs['Color'],mix.inputs[2])
    links.new(mix.outputs['Color'],shader.inputs['Base Color'])
    bake_uv=mesh.data.uv_layers.new(name='BakedUV'); mesh.data.uv_layers.active=bake_uv; bake_uv.active_render=True
    bpy.context.view_layer.objects.active=mesh; bpy.ops.object.select_all(action='DESELECT'); mesh.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.mesh.remove_doubles(threshold=.000001)
    bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.006)
    bpy.ops.object.mode_set(mode='OBJECT')
    baked=bpy.data.images.new(identity+'_baked_colour',width=2048,height=2048,alpha=False)
    target=nodes.new('ShaderNodeTexImage'); target.image=baked; nodes.active=target
    scene.render.engine='CYCLES'; scene.cycles.device='CPU'; scene.cycles.samples=1
    scene.render.bake.use_pass_direct=False; scene.render.bake.use_pass_indirect=False; scene.render.bake.use_pass_color=True
    scene.render.bake.margin=8
    bpy.ops.object.bake(type='DIFFUSE')
    baked.filepath_raw=str(directory/'albedo.png'); baked.file_format='PNG'; baked.save(); baked.pack()
    nodes.clear(); output=nodes.new('ShaderNodeOutputMaterial'); shader=nodes.new('ShaderNodeBsdfPrincipled')
    shader.inputs['Roughness'].default_value=.85
    texture=nodes.new('ShaderNodeTexImage'); texture.image=baked
    links.new(texture.outputs['Color'],shader.inputs['Base Color']); links.new(shader.outputs['BSDF'],output.inputs['Surface'])
    for name in [layer.name for layer in mesh.data.uv_layers]:
        if name != 'BakedUV': mesh.data.uv_layers.remove(mesh.data.uv_layers[name])
    mesh.data.uv_layers.active=mesh.data.uv_layers['BakedUV']; mesh.data.uv_layers.active.active_render=True
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(directory/'animated.blend'))
    for track in rig.animation_data.nla_tracks: track.mute=False
    mesh.select_set(True); rig.select_set(True)
    bpy.context.view_layer.objects.active=rig
    bpy.ops.export_scene.gltf(filepath=str(directory/'animated.glb'),export_format='GLB',use_selection=True,
                             export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True,export_morph=False)
    for track in rig.animation_data.nla_tracks: track.mute=True
    helper.reset_pose(rig); scene.frame_set(1)
    bpy.ops.object.camera_add(); scene.camera=bpy.context.object
    scene.cycles.samples=12; scene.render.resolution_x=768; scene.render.resolution_y=768; scene.render.resolution_percentage=100
    scene.world.use_nodes=True; scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.16,.19,.24,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.6
    for position,power in [((3,-4,6),450),((-3,-2,3),180),((1,3,5),250)]:
        bpy.ops.object.light_add(type='AREA',location=position); light=bpy.context.object; light.data.energy=power; light.data.size=4
        light.rotation_euler=(Vector((0,0,entries[identity]['heightMetres']/2))-light.location).to_track_quat('-Z','Y').to_euler()
    vertices=helper.points(mesh); bounds=np.array([vertices.min(axis=0),vertices.max(axis=0)])
    for angle,label in [(0,'front'),(90,'side'),(180,'rear')]: helper.render_view(scene,mesh,bounds,directory/(label+'.png'),angle)
    report['textureFinisherSha256']=script_hash; report['texture']='2048px UV-baked smooth blend of front reference and blurred rear approximation'
    report['sha256']=hashlib.sha256((directory/'animated.glb').read_bytes()).hexdigest(); report['bytes']=(directory/'animated.glb').stat().st_size
    record.write_text(json.dumps(report,indent=2)+'\n'); print('BAKED '+identity,flush=True)
