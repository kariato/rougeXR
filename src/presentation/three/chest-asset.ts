import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { AssetCache, type SceneGeneration } from './asset-cache';

const loader = new GLTFLoader();
const cache = new AssetCache<GLTF>(url => new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject)),
  value => disposeMeshes(value.scene));

/** Loads the hollow treasure chest and plays its authored lid-opening clip once. */
export async function loadChestInto(holder: THREE.Group, fallback: THREE.Object3D, generation: SceneGeneration,
  token: number, onAttached: (mixer: THREE.AnimationMixer, duration: number) => void): Promise<void> {
  try {
    const lease = await cache.acquire('/assets/props/crate.glb?v=3', {});
    if (!generation.isCurrent(token) || !holder.parent) { lease.release(); return; }
    const clip = lease.value.animations.find(animation => animation.name === 'open');
    if (!clip) { lease.release(); return; }
    const instance = lease.value.scene.clone(true);
    instance.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry = object.geometry.clone();
      object.material = Array.isArray(object.material) ? object.material.map(material => material.clone()) : object.material.clone();
    });
    const mixer = new THREE.AnimationMixer(instance);
    const action = mixer.clipAction(clip); action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; action.play();
    lease.release();
    holder.remove(fallback); disposeMeshes(fallback); holder.add(instance);
    onAttached(mixer, clip.duration);
  } catch {
    // The closed primitive chest remains visible if the animated GLB cannot load.
  }
}

function disposeMeshes(root: THREE.Object3D): void {
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose();
  });
}
