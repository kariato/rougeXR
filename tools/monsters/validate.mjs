/** Independent Three.js round-trip validation, including actual skinned vertices. */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const root = path.resolve(import.meta.dirname, '../..');
const catalog = JSON.parse(await fs.readFile(path.join(root, 'art/monster-references/hunyuan-v1/prompts.json'), 'utf8')).monsters;
const selected = process.argv.slice(2);
const report = [];
const loader = new GLTFLoader();
// Textures are audited in the GLB JSON. Skinning checks do not need a DOM/image decoder.
loader.register(() => ({ name: 'audit_texture', loadTexture: () => Promise.resolve(new THREE.Texture()) }));
for (const entry of catalog.filter(e => !selected.length || selected.includes(e.id))) {
  const file = path.join(root, 'out/monsters-v1', entry.id, 'animated.glb');
  const bytes = await fs.readFile(file);
  const jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8'));
  assert(json.buffers.every(b => !b.uri), 'External buffers');
  assert(json.images?.length && json.images.every(i => i.bufferView !== undefined && !i.uri), 'Unembedded textures');
  const gltf = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const names = gltf.animations.map(c => c.name);
  assert.deepEqual([...names].sort(), ['idle', 'move', 'attack', 'hurt', 'death'].sort(), entry.id + ' clips');
  const meshes = [];
  gltf.scene.traverse(o => { if (o.isSkinnedMesh) meshes.push(o); });
  assert(meshes.length, entry.id + ' has no skinned mesh');
  let triangles = 0;
  for (const mesh of meshes) {
    const g = mesh.geometry;
    triangles += (g.index?.count ?? g.attributes.position.count) / 3;
    const weights = g.attributes.skinWeight, joints = g.attributes.skinIndex;
    for (let i = 0; i < weights.count; i++) {
      let sum = 0;
      for (let j = 0; j < 4; j++) {
        const w = weights.getComponent(i, j), bone = joints.getComponent(i, j);
        assert(Number.isFinite(w) && w >= 0 && bone < mesh.skeleton.bones.length, 'Invalid skin influence');
        sum += w;
      }
      assert(Math.abs(sum - 1) < .001, 'Unnormalized skin weights');
    }
  }
  assert(triangles <= 12000, entry.id + ' exceeds triangle budget');
  const mixer = new THREE.AnimationMixer(gltf.scene);
  const point = new THREE.Vector3();
  function sample() {
    gltf.scene.updateMatrixWorld(true);
    const vertices = [];
    for (const mesh of meshes) {
      mesh.skeleton.update();
      const count = mesh.geometry.attributes.position.count;
      for (let i = 0; i < count; i += Math.max(1, Math.floor(count / 1500))) {
        mesh.getVertexPosition(i, point).applyMatrix4(mesh.matrixWorld);
        assert(point.toArray().every(Number.isFinite), 'Nonfinite skinned vertex');
        vertices.push(...point.toArray());
      }
    }
    return vertices;
  }
  const clips = [];
  for (const clip of gltf.animations) {
    mixer.stopAllAction();
    const action = mixer.clipAction(clip).reset();
    action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; action.play();
    mixer.setTime(0);
    const first = sample();
    let motion = 0, minimumY = Infinity, final = first;
    for (let i = 1; i <= 12; i++) {
      mixer.setTime(clip.duration * i / 12); final = sample();
      for (let j = 0; j < final.length; j++) {
        motion = Math.max(motion, Math.abs(final[j] - first[j]));
        if (j % 3 === 1) minimumY = Math.min(minimumY, final[j]);
      }
    }
    assert(motion > .0001, entry.id + ': static ' + clip.name);
    const loopError = Math.max(...final.map((v, i) => Math.abs(v - first[i])));
    if (clip.name === 'idle' || clip.name === 'move') assert(loopError < .002, entry.id + ': broken loop ' + clip.name + ' ' + loopError);
    assert(minimumY > -.025, entry.id + ': below ground in ' + clip.name + ': ' + minimumY);
    clips.push({ name: clip.name, duration: clip.duration, motion, minimumY, loopError });
  }
  report.push({ id: entry.id, bytes: bytes.length, triangles, bones: meshes[0].skeleton.bones.length, clips, result: 'passed' });
  console.log('PASS ' + entry.id + ' — ' + triangles + ' triangles, five deforming clips');
  gltf.scene.traverse(o => { if (o.isMesh) { o.geometry.dispose(); for (const m of [].concat(o.material)) m.dispose(); } });
}
await fs.writeFile(path.join(root, 'out/monsters-v1/validation.json'), JSON.stringify(report, null, 2) + '\n');
console.log(report.length + ' animated monsters verified');
