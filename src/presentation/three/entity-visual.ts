import * as THREE from 'three';
import type { DecorationKind, RoomTheme } from '../../engine/model/state';

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

export function createDecorationVisual(kind: DecorationKind, theme: RoomTheme, variant: number): THREE.Object3D {
  if (kind === 'crate') return createChestFallback();
  if (kind === 'torch') return createTorchFallback();
  const colors: Record<RoomTheme, number> = { dungeon: 0x6f6254, cave: 0x435448, crypt: 0x77706c, store: 0x76543c, treasure: 0xb58b37, none: 0x555555 };
  const material = new THREE.MeshStandardMaterial({ color: colors[theme], roughness: kind === 'coinScatter' ? 0.35 : 0.9,
    emissive: kind === 'mushroom' ? 0x102d20 : kind === 'coinScatter' ? 0x2b1900 : 0x000000 });
  let geometry: THREE.BufferGeometry;
  if (kind === 'pillar') geometry = new THREE.CylinderGeometry(0.16 + variant * 0.025, 0.2, 0.85, 7);
  else if (kind === 'urn') geometry = new THREE.SphereGeometry(0.18, 7, 5);
  else if (kind === 'mushroom') geometry = new THREE.ConeGeometry(0.18, 0.3, 7);
  else if (kind === 'bones') geometry = new THREE.CapsuleGeometry(0.035, 0.3, 2, 6);
  else if (kind === 'coinScatter') geometry = new THREE.CylinderGeometry(0.22, 0.24, 0.035, 10);
  else geometry = new THREE.DodecahedronGeometry(0.18 + variant * 0.03, 0);
  const mesh = new THREE.Mesh(geometry, material); mesh.position.y = kind === 'pillar' ? 0.425 : kind === 'urn' ? 0.18 : kind === 'coinScatter' ? 0.025 : 0.12;
  return mesh;
}

function createChestFallback(): THREE.Group {
  const root = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x754426, roughness: .9 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xc28b34, metalness: .65, roughness: .4 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(.52, .35, .38), wood); body.position.y = .19;
  const lid = new THREE.Mesh(new THREE.BoxGeometry(.55, .16, .42), wood); lid.position.y = .44;
  const band = new THREE.Mesh(new THREE.BoxGeometry(.09, .51, .045), brass); band.position.set(0, .27, .22);
  root.add(body, lid, band);
  return root;
}

function createTorchFallback(): THREE.Group {
  const root = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x383c41, metalness: .65, roughness: .6 });
  const fire = new THREE.MeshStandardMaterial({ color: 0xff8126, emissive: 0xff570b, emissiveIntensity: 2.5 });
  const plate = new THREE.Mesh(new THREE.BoxGeometry(.22, .29, .04), metal);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(.045, .045, .22), metal); arm.position.set(0, -.07, .12);
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(.09, .07, .10, 8), metal); cup.position.set(0, .02, .23);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(.07, .27, 7), fire); flame.position.set(0, .19, .23);
  root.add(plate, arm, cup, flame);
  return root;
}
