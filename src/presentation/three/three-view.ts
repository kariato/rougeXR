import * as THREE from 'three';
import type { PresentationEvent } from '../../engine/model/action';
import type { PlayerObservation } from '../../engine/model/observation';
import type { GameView } from '../game-view';
import { buildPrimitiveCells } from './scene-plan';

const TILE = 1;

/** Primitive first-person desktop view built solely from the safe player observation. */
export class ThreeGameView implements GameView {
  readonly canvas = document.createElement('canvas');
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(68, 1, 0.05, 120);
  private readonly world = new THREE.Group();
  private width = 1;
  private height = 1;

  constructor() {
    this.canvas.id = 'dungeon-3d';
    this.canvas.setAttribute('aria-label', 'First-person dungeon view');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x05080d);
    this.scene.background = new THREE.Color(0x05080d);
    this.scene.fog = new THREE.FogExp2(0x05080d, 0.055);
    this.scene.add(this.world);
    this.scene.add(new THREE.HemisphereLight(0xa9c8e8, 0x18202a, 1.7));
    const lamp = new THREE.PointLight(0xffd7a0, 12, 9, 1.7);
    lamp.position.set(0, 1.3, 0);
    this.camera.add(lamp);
    this.scene.add(this.camera);
  }

  mount(host: HTMLElement): void {
    this.canvas.hidden = false;
    if (this.canvas.parentElement !== host) host.append(this.canvas);
    const bounds = host.getBoundingClientRect();
    this.resize(bounds.width, bounds.height);
  }

  update(observation: PlayerObservation, _events: PresentationEvent[]): void {
    this.clearWorld();
    const floorGeometry = new THREE.PlaneGeometry(TILE, TILE);
    floorGeometry.rotateX(-Math.PI / 2);
    const wallGeometry = new THREE.BoxGeometry(TILE, 1.8, TILE);
    const floorVisible = new THREE.MeshStandardMaterial({ color: 0x344457, roughness: 0.95 });
    const floorRemembered = new THREE.MeshStandardMaterial({ color: 0x202a36, roughness: 1 });
    const wallVisible = new THREE.MeshStandardMaterial({ color: 0x66788b, roughness: 0.9 });
    const wallRemembered = new THREE.MeshStandardMaterial({ color: 0x303b47, roughness: 1 });
    const doorMaterial = new THREE.MeshStandardMaterial({ color: 0x7d4d2f, roughness: 0.85 });

    for (const cell of buildPrimitiveCells(observation)) {
      if (cell.kind === 'wall') {
        const mesh = new THREE.Mesh(wallGeometry, cell.visibility === 'visible' ? wallVisible : wallRemembered);
        mesh.position.set(cell.x, 0.9, cell.z); this.world.add(mesh);
      } else {
        const floor = new THREE.Mesh(floorGeometry, cell.visibility === 'visible' ? floorVisible : floorRemembered);
        floor.position.set(cell.x, 0, cell.z); this.world.add(floor);
        if (cell.kind === 'door') {
          const door = new THREE.Mesh(new THREE.BoxGeometry(0.82, 1.65, 0.16), doorMaterial);
          door.position.set(cell.x, 0.825, cell.z); this.world.add(door);
        }
      }
    }

    const player = observation.playerAt;
    this.camera.position.set(player.x, 0.72, player.y);
    this.camera.lookAt(player.x, 0.72, player.y - 1);
    this.renderer.render(this.scene, this.camera);
  }

  resize(width: number, height: number): void {
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height, false);
  }

  dispose(): void {
    this.canvas.hidden = true;
    this.clearWorld();
  }

  private clearWorld(): void {
    for (const child of [...this.world.children]) {
      this.world.remove(child);
      if (!(child instanceof THREE.Mesh)) continue;
      child.geometry.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) material.dispose();
    }
  }
}
