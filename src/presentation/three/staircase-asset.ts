import * as THREE from 'three';

/** One-tile spiral stairwell, with descending stone treads and a brass handrail. */
export function createStaircaseVisual(): THREE.Group {
  const root = new THREE.Group(); root.name = 'spiral-staircase-down';
  const stone = new THREE.MeshStandardMaterial({ color: 0x9b9c98, roughness: .85 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xd0a45a, metalness: .6, roughness: .35 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x080b10, roughness: 1 });
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number): THREE.Mesh => {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); root.add(mesh); return mesh;
  };
  add(new THREE.BoxGeometry(.98, .08, .98), dark, 0, -1.15, 0);
  add(new THREE.CylinderGeometry(.055, .055, 2.05, 12), brass, 0, -.3, 0);
  // The broad top landing makes the stairs recognizable from any approach.
  const rim = add(new THREE.TorusGeometry(.44, .035, 6, 32), stone, 0, .025, 0); rim.rotation.x = Math.PI / 2;
  for (let i = 0; i < 16; i++) {
    const angle = i * Math.PI / 6, height = -.025 - i * .065;
    const tread = add(new THREE.CylinderGeometry(.415, .415, .055, 8, 1, false, angle, Math.PI / 6), stone, 0, height, 0);
    tread.name = `descending-tread-${i}`;
    const x = Math.sin(angle) * .43, z = Math.cos(angle) * .43;
    add(new THREE.CylinderGeometry(.012, .012, .52, 6), brass, x, height + .26, z);
    const next = new THREE.Vector3(Math.sin(angle + Math.PI / 6) * .43, height + .455, Math.cos(angle + Math.PI / 6) * .43);
    const from = new THREE.Vector3(x, height + .52, z), delta = next.clone().sub(from);
    const rail = add(new THREE.CylinderGeometry(.018, .018, delta.length(), 6), brass, 0, 0, 0);
    rail.position.copy(from.add(next).multiplyScalar(.5)); rail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  }
  return root;
}
