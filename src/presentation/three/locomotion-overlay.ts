import * as THREE from 'three';
import type { LocomotionSample } from '../xr/locomotion';

/** A per-eye screen overlay; it never changes the tracked camera pose. */
export class LocomotionOverlay {
  readonly root: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  constructor() {
    this.root = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      transparent: true, depthTest: false, depthWrite: false,
      uniforms: { fade: { value: 0 }, vignette: { value: 0 } },
      vertexShader: 'varying vec2 screenUv; void main(){ screenUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }',
      fragmentShader: 'varying vec2 screenUv; uniform float fade; uniform float vignette; void main(){ float edge=smoothstep(0.28,0.64,length(screenUv-0.5)); gl_FragColor=vec4(0.0,0.0,0.0,max(fade,edge*vignette)); }',
    }));
    this.root.frustumCulled = false; this.root.renderOrder = 1000; this.root.visible = false;
  }
  update(sample: LocomotionSample): void {
    this.root.material.uniforms.fade!.value = sample.fade;
    this.root.material.uniforms.vignette!.value = sample.vignette;
    this.root.visible = sample.fade > 0 || sample.vignette > 0;
  }
  reset(): void { this.root.visible = false; }
}
