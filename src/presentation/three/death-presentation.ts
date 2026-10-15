import * as THREE from 'three';

/** Shader desaturation works on textured models too, including in the XR renderer. */
export class DeathPresentation {
  readonly label: THREE.Mesh;
  private readonly grayscale = { value: 0 };
  private readonly prepared = new WeakSet<THREE.Material>();
  constructor() {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 384;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#080808'; ctx.fillRect(0, 0, 1024, 384);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 8; ctx.strokeRect(8, 8, 1008, 368);
    ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff'; ctx.font = 'bold 190px sans-serif'; ctx.fillText('DEAD', 512, 230);
    ctx.font = '36px sans-serif'; ctx.fillText('Your journey ends here', 512, 310);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    this.label = new THREE.Mesh(new THREE.PlaneGeometry(.95, .356), new THREE.MeshBasicMaterial({ map: texture, depthTest: false, depthWrite: false, toneMapped: false }));
    this.label.position.set(0, 0, -.9); this.label.renderOrder = 300; this.label.visible = false;
  }
  update(dead: boolean, world: THREE.Object3D): void {
    this.grayscale.value = dead ? 1 : 0; this.label.visible = dead;
    world.traverse(object => {
      if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.Line)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (this.prepared.has(material) || material instanceof THREE.ShaderMaterial) continue;
        this.prepared.add(material);
        const previous = material.onBeforeCompile.bind(material), cacheKey = material.customProgramCacheKey();
        material.onBeforeCompile = (shader: THREE.WebGLProgramParametersWithUniforms, renderer: THREE.WebGLRenderer) => {
          previous(shader, renderer); shader.uniforms.deathGrayscale = this.grayscale;
          shader.fragmentShader = 'uniform float deathGrayscale;\n' + shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace('#include <colorspace_fragment>',
            '#include <colorspace_fragment>\n gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(dot(gl_FragColor.rgb, vec3(0.2126,0.7152,0.0722))), deathGrayscale);');
        };
        material.customProgramCacheKey = () => cacheKey + ':death-grayscale'; material.needsUpdate = true;
      }
    });
  }
  dispose(): void { this.label.geometry.dispose(); const material = this.label.material as THREE.MeshBasicMaterial; material.map?.dispose(); material.dispose(); }
}
