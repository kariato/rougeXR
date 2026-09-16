import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { AssetCache, type SceneGeneration } from './asset-cache';

const loader = new GLTFLoader();
const cache = new AssetCache<GLTF>(url => new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject)),
  value => disposeMeshes(value.scene));

export function createDoorFallback(): { root: THREE.Group; hinge: THREE.Group } {
  const root = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: 0x82745e, roughness: 0.94 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x754528, roughness: 0.89 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x343a3d, metalness: 0.65, roughness: 0.55 });
  const piece = (w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material): void => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material); mesh.position.set(x, y, z); root.add(mesh);
  };
  piece(0.12, 1.72, 0.17, -0.44, 0.86, 0, stone);
  piece(0.12, 1.72, 0.17, 0.44, 0.86, 0, stone);
  piece(1.0, 0.16, 0.18, 0, 1.66, 0, stone);
  const hinge = new THREE.Group(); hinge.position.x = -0.38; root.add(hinge);
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.74, 1.43, 0.07), wood);
  leaf.position.set(0.37, 0.77, 0); hinge.add(leaf);
  for (const z of [-0.055, 0.055]) for (const y of [0.28, 1.22]) {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.055, 0.028), iron);
    strap.position.set(0.37, y, z); hinge.add(strap);
  }
  for (const z of [-0.085, 0.085]) {
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.025, 12), iron);
    plate.rotation.x = Math.PI / 2; plate.position.set(0.61, 0.83, z); hinge.add(plate);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.045, 0.035), iron);
    handle.position.set(0.51, 0.83, z + Math.sign(z) * 0.025); hinge.add(handle);
  }
  return { root, hinge };
}

/** Imported leaf has a named `open` clip and clamps at its room-side final pose. */
export async function loadDoorInto(holder: THREE.Group, fallback: THREE.Object3D, generation: SceneGeneration,
  token: number, openedAt: number | null, onAttached: (mixer: THREE.AnimationMixer | null, hinge: THREE.Object3D | null) => void): Promise<void> {
  try {
    const lease = await cache.acquire('/assets/props/door.glb?v=2', {});
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
    if (openedAt !== null) {
      const action = mixer.clipAction(clip); action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; action.play();
      mixer.setTime(Math.min(clip.duration, Math.max(0, (performance.now() - openedAt) / 1000)));
    }
    lease.release();
    holder.remove(fallback); disposeMeshes(fallback); holder.add(instance);
    onAttached(openedAt === null ? null : mixer, instance.getObjectByName('door_hinge') ?? null);
  } catch {
    // The hinged fallback still swings when the GLB is unavailable.
  }
}

function disposeMeshes(root: THREE.Object3D): void {
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose();
  });
}
