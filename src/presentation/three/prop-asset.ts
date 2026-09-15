import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { AssetCache, type SceneGeneration } from './asset-cache';

const loader = new GLTFLoader();
const cache = new AssetCache<GLTF>(url => new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject)),
  value => disposeMeshes(value.scene));

/** Replaces an observed item's primitive only while its scene generation is live. */
export async function loadPropInto(url: string, holder: THREE.Group, fallback: THREE.Object3D,
  generation: SceneGeneration, token: number, onAttached?: () => void): Promise<void> {
  try {
    const lease = await cache.acquire(url, {});
    if (!generation.isCurrent(token)) { lease.release(); return; }
    const instance = lease.value.scene.clone(true);
    instance.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry = object.geometry.clone();
      object.material = Array.isArray(object.material) ? object.material.map(material => material.clone()) : object.material.clone();
    });
    lease.release();
    holder.remove(fallback);
    disposeMeshes(fallback);
    holder.add(instance);
    onAttached?.();
  } catch {
    // The observed pickup remains playable as its original primitive.
  }
}

function disposeMeshes(root: THREE.Object3D): void {
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose();
  });
}
