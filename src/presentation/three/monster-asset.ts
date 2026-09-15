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
  if (entity.label === 'B' || entity.label === 'monster.bat') return 'bat';
  if (entity.label === 'K' || entity.label === 'monster.kestrel') return 'kestrel';
  if (entity.label === 'A' || entity.label === 'monster.aquator') return 'aquator';
  if (entity.label === 'C' || entity.label === 'monster.centaur') return 'centaur';
  if (entity.label === 'D' || entity.label === 'monster.dragon') return 'dragon';
  if (entity.label === 'E' || entity.label === 'monster.emu') return 'emu';
  if (entity.label === 'F' || entity.label === 'monster.venus-flytrap') return 'venus-flytrap';
  if (entity.label === 'G' || entity.label === 'monster.griffin') return 'griffin';
  if (entity.label === 'H' || entity.label === 'monster.hobgoblin') return 'hobgoblin';
  if (entity.label === 'I' || entity.label === 'monster.ice-monster') return 'ice-monster';
  if (entity.label === 'J' || entity.label === 'monster.jabberwock') return 'jabberwock';
  if (entity.label === 'L' || entity.label === 'monster.leprechaun') return 'leprechaun';
  if (entity.label === 'M' || entity.label === 'monster.medusa') return 'medusa';
  if (entity.label === 'N' || entity.label === 'monster.nymph') return 'nymph';
  if (entity.label === 'O' || entity.label === 'monster.orc') return 'orc';
  if (entity.label === 'P' || entity.label === 'monster.phantom') return 'phantom';
  if (entity.label === 'Q' || entity.label === 'monster.quagga') return 'quagga';
  if (entity.label === 'R' || entity.label === 'monster.rattlesnake') return 'rattlesnake';
  if (entity.label === 'S' || entity.label === 'monster.snake') return 'snake';
  if (entity.label === 'T' || entity.label === 'monster.troll') return 'troll';
  if (entity.label === 'U' || entity.label === 'monster.black-unicorn') return 'black-unicorn';
  if (entity.label === 'V' || entity.label === 'monster.vampire') return 'vampire';
  if (entity.label === 'W' || entity.label === 'monster.wraith') return 'wraith';
  if (entity.label === 'X' || entity.label === 'monster.xeroc') return 'xeroc';
  if (entity.label === 'Y' || entity.label === 'monster.yeti') return 'yeti';
  if (entity.label === 'Z' || entity.label === 'monster.zombie') return 'zombie';
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
