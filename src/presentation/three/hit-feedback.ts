import * as THREE from 'three';
import type { PresentationEvent } from '../../engine/model/action';

/** Cosmetic hit feedback; never submits an action or consumes gameplay RNG. */
export class HitFeedback {
  readonly root = new THREE.Group();
  private readonly overlayMaterial = new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false,
    uniforms: { strength: { value: 0 } },
    vertexShader: 'varying vec2 uvScreen; void main(){ uvScreen=uv; gl_Position=vec4(position.xy,0.0,1.0); }',
    fragmentShader: 'varying vec2 uvScreen; uniform float strength; void main(){ float edge=smoothstep(0.15,0.7,length(uvScreen-0.5)); gl_FragColor=vec4(0.85,0.025,0.015,edge*strength*0.65); }',
  });
  private readonly overlay = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.overlayMaterial);
  private impacts: Array<{ mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>; start: number }> = [];
  private damageAt = -Infinity;
  constructor() {
    this.overlay.frustumCulled = false; this.overlay.renderOrder = 100; this.overlay.visible = false;
    this.root.add(this.overlay);
  }
  trigger(events: readonly PresentationEvent[], damageTaken: boolean, now: number): void {
    if (damageTaken) this.damageAt = now;
    for (const event of events) {
      if (event.type !== 'visibleAttack' || !event.hit || event.defenderToken === 'player') continue;
      const mesh = new THREE.Mesh(new THREE.RingGeometry(.08, .13, 12),
        new THREE.MeshBasicMaterial({ color: 0xffd17a, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
      mesh.position.set(event.defenderAt.x, .65, event.defenderAt.y);
      mesh.renderOrder = 5; this.root.add(mesh); this.impacts.push({ mesh, start: now });
    }
  }
  update(now: number, camera: THREE.Camera): boolean {
    const strength = Math.max(0, 1 - (now - this.damageAt) / 450);
    this.overlayMaterial.uniforms.strength!.value = strength;
    this.overlay.visible = strength > 0;
    this.impacts = this.impacts.filter(({ mesh, start }) => {
      const progress = (now - start) / 350;
      if (progress >= 1) { this.root.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); return false; }
      mesh.quaternion.copy(camera.quaternion); mesh.scale.setScalar(1 + progress * 3);
      mesh.material.opacity = 1 - progress;
      return true;
    });
    return strength > 0 || this.impacts.length > 0;
  }
  reset(): void {
    for (const { mesh } of this.impacts) { this.root.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); }
    this.impacts = []; this.damageAt = -Infinity; this.overlay.visible = false;
  }
  dispose(): void { this.reset(); this.overlay.geometry.dispose(); this.overlayMaterial.dispose(); }
}
