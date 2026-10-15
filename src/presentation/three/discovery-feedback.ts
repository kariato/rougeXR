import * as THREE from 'three';
import type { PresentationEvent } from '../../engine/model/action';
/** Timed outlines and rising sparkles mark only explicitly disclosed discoveries. */
export class DiscoveryFeedback {
  readonly root = new THREE.Group();
  private effects: Array<{ group: THREE.Group; start: number }> = [];
  trigger(events: readonly PresentationEvent[], now: number): void {
    for (const event of events) if (event.type === 'visibleDiscovery') {
      const group = new THREE.Group(); group.position.set(event.at.x, .035, event.at.y);
      const material = new THREE.MeshBasicMaterial({ color: 0x7ff4d1, transparent: true, depthWrite: false, toneMapped: false });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.4, .025, 6, 32), material); ring.rotation.x = Math.PI / 2; group.add(ring);
      for (let i = 0; i < 8; i++) {
        const spark = new THREE.Mesh(new THREE.OctahedronGeometry(.035), material);
        spark.position.set(Math.sin(i * Math.PI / 4) * .36, .15 + i % 3 * .08, Math.cos(i * Math.PI / 4) * .36); group.add(spark);
      }
      if (/door|passage/.test(event.feature)) {
        for (const x of [-.42, .42]) { const edge = new THREE.Mesh(new THREE.BoxGeometry(.025, 1.35, .025), material); edge.position.set(x, .675, 0); group.add(edge); }
      }
      this.root.add(group); this.effects.push({ group, start: now });
    }
  }
  update(now: number): void {
    this.effects = this.effects.filter(({ group, start }) => {
      const progress = (now - start) / 1600;
      if (progress >= 1) { this.remove(group); return false; }
      group.children.forEach((mesh, index) => {
        if (mesh instanceof THREE.Mesh) (mesh.material as THREE.MeshBasicMaterial).opacity = (1 - progress) * (.75 + .25 * Math.sin(progress * Math.PI * 6));
        if (index > 0 && index < 9) mesh.position.y = .15 + index % 3 * .08 + progress * .6;
      }); return true;
    });
  }
  private remove(group: THREE.Group): void {
    this.root.remove(group); const materials = new Set<THREE.Material>();
    group.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); materials.add(object.material); } });
    for (const material of materials) material.dispose();
  }
  reset(): void { for (const { group } of this.effects) this.remove(group); this.effects = []; }
}
