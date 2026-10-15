import * as THREE from 'three';
import type { TrapKind } from '../../engine/model/state';
export const TRAP_LABELS: Record<TrapKind, string> = {
  trapDoor: 'Trapdoor', bear: 'Bear trap', sleep: 'Sleeping gas', arrow: 'Arrow trap',
  teleport: 'Teleport trap', dart: 'Poison dart', rust: 'Rust spray', mystery: 'Mystery trap',
};
export function observedTrapKind(label: string | null | undefined): TrapKind | null {
  if (!label?.endsWith(' trap')) return null;
  const kind = label.slice(0, -5); return Object.hasOwn(TRAP_LABELS, kind) ? kind as TrapKind : null;
}
/** Distinct silhouettes for already-revealed traps only. Geometry never blocks movement. */
export function createTrapVisual(kind: TrapKind): THREE.Group {
  const root = new THREE.Group(); root.name = `revealed-trap-${kind}`;
  const steel = new THREE.MeshStandardMaterial({ color: 0x9ca6ad, metalness: .65, roughness: .45 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x252a2d, roughness: .9 });
  const colors: Record<TrapKind, number> = { trapDoor: 0xc59a62, bear: 0xe4b476, sleep: 0xc1a9f0, arrow: 0xf0cd7d, teleport: 0x66dce9, dart: 0x95dc62, rust: 0xdd814d, mystery: 0xd293f1 };
  const glow = new THREE.MeshStandardMaterial({ color: colors[kind], emissive: colors[kind], emissiveIntensity: .25, roughness: .7 });
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = .04, z = 0): THREE.Mesh => {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); root.add(mesh); return mesh;
  };
  const ring = add(new THREE.TorusGeometry(.36, .018, 6, 32), glow); ring.rotation.x = Math.PI / 2;
  if (kind === 'trapDoor') {
    add(new THREE.BoxGeometry(.59, .045, .59), dark);
    for (let i = -2; i <= 2; i++) add(new THREE.BoxGeometry(.105, .035, .55), glow, i * .11, .067);
    for (const z of [-.18, .18]) add(new THREE.BoxGeometry(.57, .025, .04), steel, 0, .093, z);
  } else if (kind === 'bear') {
    add(new THREE.CylinderGeometry(.14, .14, .035, 16), dark, 0, .055);
    for (const side of [-1, 1]) {
      const jaw = add(new THREE.TorusGeometry(.26, .025, 6, 16, Math.PI), steel, 0, .09, side * .05);
      jaw.rotation.set(-Math.PI / 3 * side, 0, side < 0 ? Math.PI : 0);
      for (let i = 0; i < 7; i++) {
        const a = i * Math.PI / 6;
        add(new THREE.ConeGeometry(.024, .11, 4), steel, Math.cos(a) * .25, .12, side * (.07 + Math.sin(a) * .18));
      }
    }
  } else if (kind === 'arrow' || kind === 'dart') {
    add(new THREE.BoxGeometry(.62, .025, .45), dark);
    for (let i = -1; i <= 1; i++) {
      const shaft = add(new THREE.CylinderGeometry(.012, .012, .43, 6), steel, i * .13, .09); shaft.rotation.x = Math.PI / 2;
      const tip = add(new THREE.ConeGeometry(kind === 'dart' ? .045 : .055, .12, 4), glow, i * .13, .09, -.24); tip.rotation.x = -Math.PI / 2;
    }
  } else if (kind === 'sleep' || kind === 'rust') {
    add(new THREE.CylinderGeometry(.23, .26, .06, 16), dark);
    for (let i = -2; i <= 2; i++) add(new THREE.BoxGeometry(.025, .025, .36), steel, i * .075, .085);
    for (let i = 0; i < 4; i++) add(new THREE.SphereGeometry(.045 + i * .015, 8, 6), glow,
      Math.sin(i * 2) * .12, .14 + i * .075, Math.cos(i * 2) * .1);
  } else {
    const inner = add(new THREE.TorusGeometry(.23, .025, 6, kind === 'teleport' ? 32 : 5), glow); inner.rotation.x = Math.PI / 2;
    for (let i = 0; i < (kind === 'teleport' ? 6 : 3); i++) {
      const angle = i * Math.PI * 2 / (kind === 'teleport' ? 6 : 3);
      add(new THREE.OctahedronGeometry(.045), glow, Math.sin(angle) * .27, .13, Math.cos(angle) * .27);
    }
  }
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 96;
  const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#08121ee8'; ctx.fillRect(0, 0, 512, 96);
  ctx.font = 'bold 36px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff'; ctx.fillText(TRAP_LABELS[kind], 256, 62);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }); material.userData.ownedMap = true;
  const label = new THREE.Mesh(new THREE.PlaneGeometry(.62, .116), material); label.position.set(0, .48, 0); label.userData.faceCamera = true; root.add(label);
  return root;
}
