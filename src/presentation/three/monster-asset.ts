import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import type { ObservedEntity } from '../../engine/model/observation';
import { AssetCache, type SceneGeneration } from './asset-cache';

const loader = new GLTFLoader();
const cache = new AssetCache<GLTF>(url => new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject)),
  value => disposeMeshes(value.scene));

/** Disguised, detected and hallucinated creatures never select a specific model. */
export function observedMonsterAsset(entity: ObservedEntity): string | null {
  if (entity.label === 'K' || entity.label === 'monster.kestrel') return 'kestrel';
  return null;
}

export async function loadMonsterInto(id: string, holder: THREE.Group, fallback: THREE.Object3D,
  generation: SceneGeneration, token: number, moving: boolean, onMixer: (mixer: THREE.AnimationMixer) => void): Promise<void> {
  try {
    const lease = await cache.acquire(`/assets/creatures/${id}.glb`, {});
    if (!generation.isCurrent(token)) { lease.release(); return; }
    const instance = cloneSkeleton(lease.value.scene);
    instance.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry = object.geometry.clone();
      object.material = Array.isArray(object.material) ? object.material.map(material => material.clone()) : object.material.clone();
    });
    const mixer = new THREE.AnimationMixer(instance);
    const idle = lease.value.animations.find(clip => clip.name === 'idle');
    const move = lease.value.animations.find(clip => clip.name === 'move');
    if (idle) mixer.clipAction(idle).play();
    if (moving && move) {
      const action = mixer.clipAction(move); action.reset(); action.setLoop(THREE.LoopOnce, 1); action.play();
    }
    lease.release();
    holder.remove(fallback); disposeMeshes(fallback); holder.add(instance); onMixer(mixer);
  } catch {
    // Keep the observed procedural actor if the GLB is absent or cannot load.
  }
}

function disposeMeshes(root: THREE.Object3D): void {
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose();
  });
}
