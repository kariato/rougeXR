import * as THREE from 'three';

export interface ActorVisual {
  root: THREE.Group;
  skeleton: THREE.Skeleton;
  mixer: THREE.AnimationMixer;
  playMove(): void;
}

/** Creates a self-contained procedural actor; no skeleton or mixer is shared between instances. */
export function createActorVisual(color: number): ActorVisual {
  const root = new THREE.Group();
  const animated = new THREE.Group(); root.add(animated);
  const lower = new THREE.Bone(); lower.name = 'lower';
  const upper = new THREE.Bone(); upper.name = 'upper'; upper.position.y = 0.55; lower.add(upper);
  const geometry = new THREE.BoxGeometry(0.42, 1.1, 0.35, 1, 2, 1); geometry.translate(0, 0.55, 0);
  const position = geometry.getAttribute('position');
  const indices: number[] = []; const weights: number[] = [];
  for (let index = 0; index < position.count; index++) {
    const upperWeight = position.getY(index) > 0.55 ? 1 : 0;
    indices.push(0, 1, 0, 0); weights.push(1 - upperWeight, upperWeight, 0, 0);
  }
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.75 });
  const mesh = new THREE.SkinnedMesh(geometry, material); mesh.add(lower);
  const skeleton = new THREE.Skeleton([lower, upper]); mesh.bind(skeleton); animated.add(mesh);
  const mixer = new THREE.AnimationMixer(animated);
  const moveClip = new THREE.AnimationClip('move', 0.24, [new THREE.NumberKeyframeTrack('.position[y]', [0, 0.12, 0.24], [0, 0.16, 0])]);
  return { root, skeleton, mixer, playMove: () => { const action = mixer.clipAction(moveClip); action.reset(); action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; action.play(); } };
}

export function createItemVisual(): THREE.Mesh {
  return new THREE.Mesh(new THREE.OctahedronGeometry(0.2), new THREE.MeshStandardMaterial({ color: 0xf0b84a, emissive: 0x3b2508, roughness: 0.5 }));
}
