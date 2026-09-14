import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { disposeObjectTree } from '../../src/presentation/three/three-view';

describe('3D resource disposal', () => {
  it('disposes geometry and every material in an array', () => {
    const geometry = new THREE.BoxGeometry(); const first = new THREE.MeshBasicMaterial(); const second = new THREE.MeshBasicMaterial();
    const geometryDispose = vi.spyOn(geometry, 'dispose'); const firstDispose = vi.spyOn(first, 'dispose'); const secondDispose = vi.spyOn(second, 'dispose');
    const root = new THREE.Group(); root.add(new THREE.Mesh(geometry, [first, second])); disposeObjectTree(root);
    expect(geometryDispose).toHaveBeenCalledOnce(); expect(firstDispose).toHaveBeenCalledOnce(); expect(secondDispose).toHaveBeenCalledOnce();
  });
});
