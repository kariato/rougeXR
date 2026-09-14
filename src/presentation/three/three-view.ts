import * as THREE from 'three';
import type { PresentationEvent } from '../../engine/model/action';
import type { PlayerObservation } from '../../engine/model/observation';
import type { GameView } from '../game-view';
import { buildPrimitiveCells } from './scene-plan';
import { nearestVisibleHit, smoothToward, type CameraMode } from './camera-model';

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
  private mode: CameraMode = 'firstPerson';
  private observation: PlayerObservation | null = null;
  private yaw = Math.PI;
  private targetYaw = Math.PI;
  private pitch = 0;
  private targetPitch = 0;
  private distance = 8;
  private targetDistance = 8;
  private dragging = false;
  private pointerId: number | null = null;
  private frame: number | null = null;
  private lastFrame = 0;

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
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointercancel', this.onPointerUp);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
    this.canvas.addEventListener('click', this.onClick);
    window.addEventListener('blur', this.clearCapturedInput);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.lastFrame = performance.now();
  }

  update(observation: PlayerObservation, _events: PresentationEvent[]): void {
    this.observation = observation;
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
        mesh.position.set(cell.x, 0.9, cell.z); mesh.userData = { cell: { x: cell.x, y: cell.z }, eligible: false, occludes: true }; this.world.add(mesh);
      } else {
        const floor = new THREE.Mesh(floorGeometry, cell.visibility === 'visible' ? floorVisible : floorRemembered);
        floor.position.set(cell.x, 0, cell.z); floor.userData = { cell: { x: cell.x, y: cell.z }, eligible: true, occludes: false }; this.world.add(floor);
        if (cell.kind === 'door') {
          const door = new THREE.Mesh(new THREE.BoxGeometry(0.82, 1.65, 0.16), doorMaterial);
          door.position.set(cell.x, 0.825, cell.z); door.userData = { cell: { x: cell.x, y: cell.z }, eligible: true, occludes: true }; this.world.add(door);
        }
      }
    }

    this.placeCamera();
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
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerUp);
    this.canvas.removeEventListener('wheel', this.onWheel);
    this.canvas.removeEventListener('click', this.onClick);
    window.removeEventListener('blur', this.clearCapturedInput);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
    this.clearCapturedInput();
  }

  setMode(mode: CameraMode): void {
    this.mode = mode;
    this.targetPitch = mode === 'tabletop' ? -0.9 : mode === 'orbit' ? -0.2 : 0;
    this.targetDistance = mode === 'tabletop' ? 22 : 8;
    this.ensureAnimation();
  }

  private readonly animate = (now: number): void => {
    const elapsed = Math.min(0.1, Math.max(0, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    this.yaw = smoothToward(this.yaw, this.targetYaw, 14, elapsed);
    this.pitch = smoothToward(this.pitch, this.targetPitch, 14, elapsed);
    this.distance = smoothToward(this.distance, this.targetDistance, 12, elapsed);
    this.placeCamera();
    const moving = Math.abs(this.yaw - this.targetYaw) > 0.0001 || Math.abs(this.pitch - this.targetPitch) > 0.0001 || Math.abs(this.distance - this.targetDistance) > 0.001;
    this.frame = moving ? requestAnimationFrame(this.animate) : null;
  };

  private placeCamera(): void {
    const observation = this.observation;
    if (!observation) return;
    const player = observation.playerAt;
    if (this.mode === 'firstPerson') {
      this.camera.position.set(player.x, 0.72, player.y);
      const horizontal = Math.cos(this.pitch);
      this.camera.lookAt(player.x + Math.sin(this.yaw) * horizontal, 0.72 + Math.sin(this.pitch), player.y + Math.cos(this.yaw) * horizontal);
    } else {
      const targetX = this.mode === 'tabletop' ? observation.width / 2 : player.x;
      const targetZ = this.mode === 'tabletop' ? observation.height / 2 : player.y;
      const horizontal = Math.cos(this.pitch) * this.distance;
      this.camera.position.set(targetX - Math.sin(this.yaw) * horizontal, 1.2 - Math.sin(this.pitch) * this.distance, targetZ - Math.cos(this.yaw) * horizontal);
      this.camera.lookAt(targetX, 0, targetZ);
    }
    this.renderer.render(this.scene, this.camera);
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    this.dragging = true; this.pointerId = event.pointerId; this.canvas.setPointerCapture(event.pointerId);
  };
  private readonly onPointerMove = (event: PointerEvent): void => {
    if (!this.dragging || event.pointerId !== this.pointerId) return;
    this.targetYaw -= event.movementX * 0.006;
    this.targetPitch = Math.max(-1.35, Math.min(1.1, this.targetPitch - event.movementY * 0.004));
    this.ensureAnimation();
  };
  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId) return;
    this.clearCapturedInput();
  };
  private readonly onWheel = (event: WheelEvent): void => {
    if (this.mode === 'firstPerson') return;
    event.preventDefault();
    this.targetDistance = Math.max(3, Math.min(40, this.targetDistance + event.deltaY * 0.015));
    this.ensureAnimation();
  };
  private readonly onClick = (event: MouseEvent): void => {
    const bounds = this.canvas.getBoundingClientRect();
    const pointer = new THREE.Vector2((event.clientX - bounds.left) / bounds.width * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(pointer, this.camera);
    const selected = nearestVisibleHit(ray.intersectObjects(this.world.children).map(hit => ({
      distance: hit.distance,
      eligible: hit.object.userData.eligible === true,
      occludes: hit.object.userData.occludes === true,
      value: hit.object.userData.cell as { x: number; y: number },
    })));
    if (selected) this.canvas.dispatchEvent(new CustomEvent('rougexr-select-cell', { detail: selected }));
  };
  private readonly clearCapturedInput = (): void => {
    if (this.pointerId !== null && this.canvas.hasPointerCapture(this.pointerId)) this.canvas.releasePointerCapture(this.pointerId);
    this.dragging = false; this.pointerId = null;
  };
  private readonly onVisibilityChange = (): void => { if (document.hidden) this.clearCapturedInput(); };

  private ensureAnimation(): void {
    if (this.frame !== null) return;
    this.lastFrame = performance.now();
    this.frame = requestAnimationFrame(this.animate);
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
