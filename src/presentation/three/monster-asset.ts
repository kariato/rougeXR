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

export type MonsterCue = 'move' | 'attack' | 'hurt' | 'death';

export async function loadMonsterInto(id: string, holder: THREE.Group, fallback: THREE.Object3D,
  generation: SceneGeneration, token: number, cues: MonsterCue[], onMixer: (mixer: THREE.AnimationMixer) => void): Promise<void> {
  try {
    const lease = await cache.acquire(`/assets/creatures/${id}.glb`, {});
    if (!generation.isCurrent(token) || !holder.parent) { lease.release(); return; }
    const instance = cloneSkeleton(lease.value.scene);
    instance.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry = object.geometry.clone();
      object.material = Array.isArray(object.material) ? object.material.map(material => material.clone()) : object.material.clone();
    });
    const mixer = new THREE.AnimationMixer(instance);
    const idle = lease.value.animations.find(clip => clip.name === 'idle');
    const sequence=cues.map(cue=>lease.value.animations.find(clip=>clip.name===cue))
      .filter((clip):clip is THREE.AnimationClip=>clip!==undefined);
    let index=0;
    const next=():void=>{
      const clip=sequence[index++];if (!clip) {if (idle) mixer.clipAction(idle).reset().play();return;}
      const action=mixer.clipAction(clip);action.reset();action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=clip.name==='death';action.play();
    };
    if (sequence.length) {
      const finished=():void=>{if (index>=sequence.length) {mixer.removeEventListener('finished',finished);if (sequence.at(-1)?.name!=='death') next();} else next();};
      mixer.addEventListener('finished',finished);next();
    } else if (idle) mixer.clipAction(idle).play();
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
